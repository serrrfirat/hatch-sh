use std::env;
use std::path::{Path, PathBuf};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tokio::process::Command as AsyncCommand;
use tokio::io::{BufReader, AsyncBufReadExt};
use std::process::Stdio;
use tauri::{Emitter, Manager, State};

mod github;
mod git;
mod keychain;
mod skills;

use github::{github_check_gh_installed, github_login, github_get_auth_state, github_sign_out, github_validate_token};
use git::{
    git_clone_repo, git_open_local_repo, git_create_workspace_branch, git_delete_workspace_branch,
    git_list_worktrees, git_prune_worktrees,
    git_status, git_commit, git_push, git_create_pr, git_create_github_repo, git_diff,
    git_diff_stats, list_directory_files, read_file, git_file_diff, git_get_pr, git_merge_pr
};
use keychain::{keychain_set, keychain_get, keychain_delete, keychain_has};
use skills::{
    install_skill, uninstall_skill, list_installed_skills, is_skill_installed, get_skill_install_path,
    run_shell_command
};

/// Status for any agent (installed, authenticated, version, etc.)
#[derive(Serialize, Deserialize)]
pub struct AgentStatus {
    installed: bool,
    authenticated: bool,
    version: Option<String>,
    error: Option<String>,
    path: Option<String>,
}

/// Result from running an agent command
#[derive(Serialize, Deserialize)]
pub struct CommandResult {
    success: bool,
    stdout: String,
    stderr: String,
    code: Option<i32>,
}

/// Model information returned from an agent
#[derive(Serialize, Deserialize, Clone)]
pub struct ModelInfo {
    id: String,
    name: String,
    provider: Option<String>,
}

/// Result from getting available models
#[derive(Serialize, Deserialize)]
pub struct AvailableModels {
    success: bool,
    models: Vec<ModelInfo>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ProjectFileInput {
    path: String,
    content: String,
}

#[derive(Serialize, Deserialize)]
struct ProjectFileWriteResult {
    path: String,
    success: bool,
    size: usize,
    error: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum GitOperationPriority {
    Critical,
    Normal,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCoordinatorOperation {
    id: String,
    #[serde(rename = "type")]
    operation_type: String,
    repo_root: String,
    command: String,
    priority: GitOperationPriority,
    enqueued_at: u64,
    started_at: Option<u64>,
    completed_at: Option<u64>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCoordinatorQueueStatus {
    repo_root: String,
    pending_count: usize,
    running_operation: Option<GitCoordinatorOperation>,
    completed_count: usize,
    failed_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCoordinatorEnqueueRequest {
    repo_root: String,
    command: String,
    params: serde_json::Value,
    priority: Option<GitOperationPriority>,
    #[serde(rename = "type")]
    operation_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCoordinatorStatusRequest {
    repo_root: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCoordinatorCancelRequest {
    operation_id: String,
}

struct QueuedGitOperation {
    operation: GitCoordinatorOperation,
    params: serde_json::Value,
    result_tx: Option<tokio::sync::oneshot::Sender<Result<serde_json::Value, String>>>,
}

struct RunningGitOperation {
    operation: GitCoordinatorOperation,
    cancel_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

#[derive(Default)]
struct RepoQueueState {
    pending: VecDeque<QueuedGitOperation>,
    running: Option<RunningGitOperation>,
    completed_count: usize,
    failed_count: usize,
    worker_active: bool,
}

#[derive(Default)]
struct GitCoordinatorState {
    next_operation_id: u64,
    repos: HashMap<String, RepoQueueState>,
}

#[derive(Clone, Default)]
struct GitCoordinator {
    state: Arc<tokio::sync::Mutex<GitCoordinatorState>>,
}

impl GitCoordinator {
    fn new() -> Self {
        Self {
            state: Arc::new(tokio::sync::Mutex::new(GitCoordinatorState::default())),
        }
    }

    async fn enqueue(&self, request: GitCoordinatorEnqueueRequest) -> Result<serde_json::Value, String> {
        let operation_id;
        let operation;
        let (result_tx, result_rx) = tokio::sync::oneshot::channel::<Result<serde_json::Value, String>>();

        {
            let mut guard = self.state.lock().await;
            guard.next_operation_id += 1;
            operation_id = format!("git-op-{}", guard.next_operation_id);

            operation = GitCoordinatorOperation {
                id: operation_id,
                operation_type: request.operation_type.unwrap_or_else(|| request.command.clone()),
                repo_root: request.repo_root.clone(),
                command: request.command,
                priority: request.priority.unwrap_or(GitOperationPriority::Normal),
                enqueued_at: unix_timestamp_ms(),
                started_at: None,
                completed_at: None,
                error: None,
            };

            let queued_operation = QueuedGitOperation {
                operation,
                params: request.params,
                result_tx: Some(result_tx),
            };

            let repo_root = queued_operation.operation.repo_root.clone();
            let queue = guard.repos.entry(repo_root.clone()).or_default();
            queue_insert_by_priority(&mut queue.pending, queued_operation);

            if !queue.worker_active {
                queue.worker_active = true;
                let coordinator = self.clone();
                tauri::async_runtime::spawn(async move {
                    coordinator.process_repo_queue(repo_root).await;
                });
            }
        }

        result_rx
            .await
            .map_err(|_| "Git coordinator queue channel closed".to_string())?
    }

    async fn status(&self, repo_root: String) -> GitCoordinatorQueueStatus {
        let guard = self.state.lock().await;
        if let Some(queue) = guard.repos.get(&repo_root) {
            return GitCoordinatorQueueStatus {
                repo_root,
                pending_count: queue.pending.len(),
                running_operation: queue.running.as_ref().map(|running| running.operation.clone()),
                completed_count: queue.completed_count,
                failed_count: queue.failed_count,
            };
        }

        GitCoordinatorQueueStatus {
            repo_root,
            pending_count: 0,
            running_operation: None,
            completed_count: 0,
            failed_count: 0,
        }
    }

    async fn cancel(&self, operation_id: String) -> bool {
        let mut guard = self.state.lock().await;

        for queue in guard.repos.values_mut() {
            if let Some(index) = queue.pending.iter().position(|entry| entry.operation.id == operation_id) {
                if let Some(mut pending) = queue.pending.remove(index) {
                    if let Some(sender) = pending.result_tx.take() {
                        let _ = sender.send(Err("Operation cancelled".to_string()));
                    }
                    return true;
                }
            }

            if let Some(running) = queue.running.as_mut() {
                if running.operation.id == operation_id {
                    if let Some(cancel_tx) = running.cancel_tx.take() {
                        let _ = cancel_tx.send(());
                    }
                    return true;
                }
            }
        }

        false
    }

    async fn process_repo_queue(&self, repo_root: String) {
        loop {
            let (queued_operation, cancel_rx) = {
                let mut guard = self.state.lock().await;
                let queue = match guard.repos.get_mut(&repo_root) {
                    Some(queue) => queue,
                    None => break,
                };

                if queue.pending.is_empty() {
                    queue.worker_active = false;
                    queue.running = None;
                    break;
                }

                let mut next = match queue.pending.pop_front() {
                    Some(op) => op,
                    None => {
                        queue.worker_active = false;
                        queue.running = None;
                        break;
                    }
                };

                next.operation.started_at = Some(unix_timestamp_ms());
                let running_snapshot = next.operation.clone();
                let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel::<()>();

                queue.running = Some(RunningGitOperation {
                    operation: running_snapshot,
                    cancel_tx: Some(cancel_tx),
                });

                (next, cancel_rx)
            };

            let timeout_duration = Duration::from_secs(60);
            let mut dispatch_future = Box::pin(execute_coordinated_git_command(
                &queued_operation.operation.command,
                queued_operation.params.clone(),
            ));

            let execution_result: Result<serde_json::Value, String> = tokio::select! {
                _ = cancel_rx => Err("Operation cancelled".to_string()),
                timeout_result = tokio::time::timeout(timeout_duration, &mut dispatch_future) => {
                    match timeout_result {
                        Ok(result) => result,
                        Err(_) => Err("Operation timed out after 60 seconds".to_string()),
                    }
                }
            };

            let mut completed_operation = queued_operation.operation.clone();
            completed_operation.completed_at = Some(unix_timestamp_ms());

            if let Err(error_message) = &execution_result {
                completed_operation.error = Some(error_message.clone());
            }

            if let Some(sender) = queued_operation.result_tx {
                let _ = sender.send(execution_result.clone());
            }

            let mut guard = self.state.lock().await;
            if let Some(queue) = guard.repos.get_mut(&repo_root) {
                queue.running = None;
                match execution_result {
                    Ok(_) => queue.completed_count += 1,
                    Err(_) => queue.failed_count += 1,
                }
            }
        }
    }
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn queue_insert_by_priority(queue: &mut VecDeque<QueuedGitOperation>, operation: QueuedGitOperation) {
    match operation.operation.priority {
        GitOperationPriority::Critical => {
            let insert_at = queue
                .iter()
                .position(|item| item.operation.priority != GitOperationPriority::Critical)
                .unwrap_or(queue.len());
            queue.insert(insert_at, operation);
        }
        GitOperationPriority::Normal => {
            let insert_at = queue
                .iter()
                .position(|item| item.operation.priority == GitOperationPriority::Low)
                .unwrap_or(queue.len());
            queue.insert(insert_at, operation);
        }
        GitOperationPriority::Low => {
            queue.push_back(operation);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum WorktreeHealthStatus {
    Healthy,
    Orphaned,
    Locked,
    Corrupted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorktreeLifecycleInfo {
    path: String,
    branch: String,
    head_commit: String,
    is_locked: bool,
    lock_reason: Option<String>,
    health_status: WorktreeHealthStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorktreeCreateResult {
    branch_name: String,
    worktree_path: String,
    is_locked: bool,
    lock_reason: Option<String>,
    health_status: WorktreeHealthStatus,
}

#[derive(Debug, Clone)]
struct ParsedWorktreeEntry {
    path: String,
    branch: Option<String>,
    head: String,
    is_locked: bool,
    lock_reason: Option<String>,
    is_prunable: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorktreeCreateRequest {
    repo_root: String,
    workspace_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorktreeRemoveRequest {
    repo_root: String,
    worktree_path: String,
    branch_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorktreeRepoRequest {
    repo_root: String,
}

#[derive(Clone, Default)]
struct WorktreeLifecycleManager {
    operation_lock: Arc<tokio::sync::Mutex<()>>,
}

impl WorktreeLifecycleManager {
    fn new() -> Self {
        Self {
            operation_lock: Arc::new(tokio::sync::Mutex::new(())),
        }
    }

    async fn create(&self, request: WorktreeCreateRequest) -> Result<WorktreeCreateResult, String> {
        let _guard = self.operation_lock.lock().await;
        let branch_name = format!("workspace/{}", request.workspace_id);

        let existing = self.list_internal(&request.repo_root).await?;
        if existing
            .iter()
            .any(|entry| entry.branch.as_deref() == Some(branch_name.as_str()))
        {
            return Err(format!(
                "Branch '{}' is already used by another worktree",
                branch_name
            ));
        }

        let created = git_create_workspace_branch(request.repo_root.clone(), request.workspace_id).await?;

        self.lock_worktree(&request.repo_root, &created.worktree_path, "active-agent")
            .await?;

        Ok(WorktreeCreateResult {
            branch_name: created.branch_name,
            worktree_path: created.worktree_path,
            is_locked: true,
            lock_reason: Some("active-agent".to_string()),
            health_status: WorktreeHealthStatus::Locked,
        })
    }

    async fn remove(&self, request: WorktreeRemoveRequest) -> Result<(), String> {
        let _guard = self.operation_lock.lock().await;

        cleanup_index_lock_for_worktree(&request.worktree_path)?;
        self.unlock_worktree(&request.repo_root, &request.worktree_path).await?;

        run_git(
            &request.repo_root,
            &["worktree", "remove", "--force", &request.worktree_path],
        )
        .await?;

        if let Some(branch_name) = &request.branch_name {
            let _ = run_git(&request.repo_root, &["branch", "-D", branch_name]).await;
        }

        let _ = run_git(&request.repo_root, &["worktree", "prune"]).await;
        Ok(())
    }

    async fn repair(&self, repo_root: &str) -> Result<(), String> {
        let _guard = self.operation_lock.lock().await;
        self.repair_internal(repo_root).await
    }

    async fn list(&self, repo_root: &str) -> Result<Vec<WorktreeLifecycleInfo>, String> {
        let entries = self.list_internal(repo_root).await?;
        Ok(entries
            .into_iter()
            .map(|entry| {
                let health_status = derive_worktree_health(&entry);
                WorktreeLifecycleInfo {
                    path: entry.path.clone(),
                    branch: entry.branch.unwrap_or_default(),
                    head_commit: entry.head,
                    is_locked: entry.is_locked,
                    lock_reason: entry.lock_reason,
                    health_status,
                }
            })
            .collect())
    }

    async fn repair_all_known_repos(&self) {
        let repos = discover_known_repositories();
        for repo in repos {
            let _ = self.repair(&repo).await;
        }
    }

    async fn repair_internal(&self, repo_root: &str) -> Result<(), String> {
        run_git(repo_root, &["worktree", "repair"]).await?;
        run_git(repo_root, &["worktree", "prune"]).await?;

        let entries = self.list_internal(repo_root).await?;
        for entry in entries {
            let _ = cleanup_index_lock_for_worktree(&entry.path);
        }

        Ok(())
    }

    async fn lock_worktree(&self, repo_root: &str, worktree_path: &str, reason: &str) -> Result<(), String> {
        run_git(
            repo_root,
            &["worktree", "lock", "--reason", reason, worktree_path],
        )
        .await
        .map(|_| ())
    }

    async fn unlock_worktree(&self, repo_root: &str, worktree_path: &str) -> Result<(), String> {
        let output = AsyncCommand::new("git")
            .args(["-C", repo_root, "worktree", "unlock", worktree_path])
            .output()
            .await
            .map_err(|error| format!("Failed to unlock worktree: {}", error))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("is not locked") {
            return Ok(());
        }

        Err(format!("Failed to unlock worktree: {}", stderr.trim()))
    }

    async fn list_internal(&self, repo_root: &str) -> Result<Vec<ParsedWorktreeEntry>, String> {
        let output = run_git(repo_root, &["worktree", "list", "--porcelain"]).await?;
        Ok(parse_worktree_list_porcelain(&output))
    }
}

async fn run_git(repo_root: &str, args: &[&str]) -> Result<String, String> {
    let output = AsyncCommand::new("git")
        .arg("-C")
        .arg(repo_root)
        .args(args)
        .output()
        .await
        .map_err(|error| format!("Failed to execute git {}: {}", args.join(" "), error))?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
}

fn parse_worktree_list_porcelain(output: &str) -> Vec<ParsedWorktreeEntry> {
    let mut entries = Vec::new();
    let mut current: Option<ParsedWorktreeEntry> = None;

    for line in output.lines() {
        if line.starts_with("worktree ") {
            if let Some(entry) = current.take() {
                entries.push(entry);
            }

            current = Some(ParsedWorktreeEntry {
                path: line.trim_start_matches("worktree ").to_string(),
                branch: None,
                head: String::new(),
                is_locked: false,
                lock_reason: None,
                is_prunable: false,
            });
            continue;
        }

        if let Some(entry) = current.as_mut() {
            if line.starts_with("branch ") {
                entry.branch = Some(
                    line.trim_start_matches("branch ")
                        .trim_start_matches("refs/heads/")
                        .to_string(),
                );
            } else if line.starts_with("HEAD ") {
                entry.head = line.trim_start_matches("HEAD ").to_string();
            } else if line == "prunable" || line.starts_with("prunable ") {
                entry.is_prunable = true;
            } else if line == "locked" || line.starts_with("locked ") {
                entry.is_locked = true;
                let reason = line.trim_start_matches("locked").trim();
                if !reason.is_empty() {
                    entry.lock_reason = Some(reason.to_string());
                }
            }
        }
    }

    if let Some(entry) = current {
        entries.push(entry);
    }

    entries
}

fn derive_worktree_health(entry: &ParsedWorktreeEntry) -> WorktreeHealthStatus {
    let worktree_path = Path::new(&entry.path);

    if !worktree_path.exists() || entry.is_prunable {
        return WorktreeHealthStatus::Orphaned;
    }

    if !worktree_metadata_is_valid(worktree_path) {
        return WorktreeHealthStatus::Corrupted;
    }

    if entry.is_locked {
        return WorktreeHealthStatus::Locked;
    }

    WorktreeHealthStatus::Healthy
}

fn worktree_metadata_is_valid(worktree_path: &Path) -> bool {
    let git_entry = worktree_path.join(".git");
    if !git_entry.exists() {
        return false;
    }

    if git_entry.is_dir() {
        return true;
    }

    let contents = match std::fs::read_to_string(&git_entry) {
        Ok(contents) => contents,
        Err(_) => return false,
    };

    let gitdir_raw = match contents.trim().strip_prefix("gitdir:") {
        Some(raw) => raw.trim(),
        None => return false,
    };

    let gitdir_path = if Path::new(gitdir_raw).is_absolute() {
        PathBuf::from(gitdir_raw)
    } else {
        worktree_path.join(gitdir_raw)
    };

    gitdir_path.exists()
}

fn cleanup_index_lock_for_worktree(worktree_path: &str) -> Result<(), String> {
    let worktree = Path::new(worktree_path);
    let direct_lock = worktree.join(".git").join("index.lock");
    if direct_lock.exists() {
        let _ = std::fs::remove_file(&direct_lock);
    }

    let git_file = worktree.join(".git");
    if git_file.is_file() {
        let contents = std::fs::read_to_string(&git_file)
            .map_err(|error| format!("Failed to read git metadata for {}: {}", worktree_path, error))?;
        if let Some(gitdir_raw) = contents.trim().strip_prefix("gitdir:") {
            let gitdir_raw = gitdir_raw.trim();
            let gitdir_path = if Path::new(gitdir_raw).is_absolute() {
                PathBuf::from(gitdir_raw)
            } else {
                worktree.join(gitdir_raw)
            };

            let index_lock = gitdir_path.join("index.lock");
            if index_lock.exists() {
                let _ = std::fs::remove_file(index_lock);
            }
        }
    }

    Ok(())
}

fn discover_known_repositories() -> Vec<String> {
    let mut repos = Vec::new();
    let workspaces_dir = match git::get_workspaces_dir() {
        Ok(path) => path,
        Err(_) => return repos,
    };

    let dir_entries = match std::fs::read_dir(workspaces_dir) {
        Ok(entries) => entries,
        Err(_) => return repos,
    };

    for entry in dir_entries.flatten() {
        let path = entry.path();
        if path.is_dir() && path.join(".git").is_dir() {
            repos.push(path.to_string_lossy().to_string());
        }
    }

    repos
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCloneRepoParams {
    repo_url: String,
    repo_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitOpenLocalRepoParams {
    path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCreateWorkspaceBranchParams {
    repo_path: String,
    workspace_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitDeleteWorkspaceBranchParams {
    repo_path: String,
    branch_name: String,
    worktree_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitRepoPathParams {
    repo_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCommitParams {
    repo_path: String,
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitPushParams {
    repo_path: String,
    branch: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCreatePrParams {
    repo_full_name: String,
    head_branch: String,
    base_branch: String,
    title: String,
    body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitCreateGithubRepoParams {
    name: String,
    is_private: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitFileDiffParams {
    repo_path: String,
    file_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitGetPrParams {
    repo_full_name: String,
    pr_number: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitMergePrParams {
    repo_full_name: String,
    pr_number: u64,
    merge_method: Option<String>,
}

async fn execute_coordinated_git_command(
    command: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    match command {
        "git_clone_repo" => {
            let payload: GitCloneRepoParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_clone_repo: {}", e))?;
            to_json_value(git_clone_repo(payload.repo_url, payload.repo_name).await?)
        }
        "git_open_local_repo" => {
            let payload: GitOpenLocalRepoParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_open_local_repo: {}", e))?;
            to_json_value(git_open_local_repo(payload.path).await?)
        }
        "git_create_workspace_branch" => {
            let payload: GitCreateWorkspaceBranchParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_create_workspace_branch: {}", e))?;
            to_json_value(git_create_workspace_branch(payload.repo_path, payload.workspace_id).await?)
        }
        "git_delete_workspace_branch" => {
            let payload: GitDeleteWorkspaceBranchParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_delete_workspace_branch: {}", e))?;
            git_delete_workspace_branch(payload.repo_path, payload.branch_name, payload.worktree_path).await?;
            Ok(serde_json::Value::Null)
        }
        "git_list_worktrees" => {
            let payload: GitRepoPathParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_list_worktrees: {}", e))?;
            to_json_value(git_list_worktrees(payload.repo_path).await?)
        }
        "git_prune_worktrees" => {
            let payload: GitRepoPathParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_prune_worktrees: {}", e))?;
            to_json_value(git_prune_worktrees(payload.repo_path).await?)
        }
        "git_status" => {
            let payload: GitRepoPathParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_status: {}", e))?;
            to_json_value(git_status(payload.repo_path).await?)
        }
        "git_commit" => {
            let payload: GitCommitParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_commit: {}", e))?;
            to_json_value(git_commit(payload.repo_path, payload.message).await?)
        }
        "git_push" => {
            let payload: GitPushParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_push: {}", e))?;
            git_push(payload.repo_path, payload.branch).await?;
            Ok(serde_json::Value::Null)
        }
        "git_create_pr" => {
            let payload: GitCreatePrParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_create_pr: {}", e))?;
            to_json_value(git_create_pr(payload.repo_full_name, payload.head_branch, payload.base_branch, payload.title, payload.body).await?)
        }
        "git_create_github_repo" => {
            let payload: GitCreateGithubRepoParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_create_github_repo: {}", e))?;
            to_json_value(git_create_github_repo(payload.name, payload.is_private).await?)
        }
        "git_diff" => {
            let payload: GitRepoPathParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_diff: {}", e))?;
            to_json_value(git_diff(payload.repo_path).await?)
        }
        "git_diff_stats" => {
            let payload: GitRepoPathParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_diff_stats: {}", e))?;
            to_json_value(git_diff_stats(payload.repo_path).await?)
        }
        "git_file_diff" => {
            let payload: GitFileDiffParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_file_diff: {}", e))?;
            to_json_value(git_file_diff(payload.repo_path, payload.file_path).await?)
        }
        "git_get_pr" => {
            let payload: GitGetPrParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_get_pr: {}", e))?;
            to_json_value(git_get_pr(payload.repo_full_name, payload.pr_number as u32).await?)
        }
        "git_merge_pr" => {
            let payload: GitMergePrParams = serde_json::from_value(params)
                .map_err(|e| format!("Invalid params for git_merge_pr: {}", e))?;
            let merge_method = payload.merge_method.unwrap_or_else(|| "squash".to_string());
            to_json_value(git_merge_pr(payload.repo_full_name, payload.pr_number as u32, merge_method).await?)
        }
        _ => Err(format!("Unsupported coordinated command: {}", command)),
    }
}

fn to_json_value<T: Serialize>(value: T) -> Result<serde_json::Value, String> {
    serde_json::to_value(value).map_err(|e| format!("Failed to serialize operation result: {}", e))
}

#[tauri::command]
async fn git_coordinator_enqueue(
    coordinator: State<'_, GitCoordinator>,
    request: GitCoordinatorEnqueueRequest,
) -> Result<serde_json::Value, String> {
    coordinator.enqueue(request).await
}

#[tauri::command]
async fn git_coordinator_status(
    coordinator: State<'_, GitCoordinator>,
    request: GitCoordinatorStatusRequest,
) -> Result<GitCoordinatorQueueStatus, String> {
    Ok(coordinator.status(request.repo_root).await)
}

#[tauri::command]
async fn git_coordinator_cancel(
    coordinator: State<'_, GitCoordinator>,
    request: GitCoordinatorCancelRequest,
) -> Result<bool, String> {
    Ok(coordinator.cancel(request.operation_id).await)
}

#[tauri::command]
async fn worktree_create(
    manager: State<'_, WorktreeLifecycleManager>,
    request: WorktreeCreateRequest,
) -> Result<WorktreeCreateResult, String> {
    manager.create(request).await
}

#[tauri::command]
async fn worktree_remove(
    manager: State<'_, WorktreeLifecycleManager>,
    request: WorktreeRemoveRequest,
) -> Result<(), String> {
    manager.remove(request).await
}

#[tauri::command]
async fn worktree_repair(
    manager: State<'_, WorktreeLifecycleManager>,
    request: WorktreeRepoRequest,
) -> Result<(), String> {
    manager.repair(&request.repo_root).await
}

#[tauri::command]
async fn worktree_list(
    manager: State<'_, WorktreeLifecycleManager>,
    request: WorktreeRepoRequest,
) -> Result<Vec<WorktreeLifecycleInfo>, String> {
    manager.list(&request.repo_root).await
}

#[tauri::command]
async fn write_project_files(files: Vec<ProjectFileInput>, base_dir: String) -> Vec<ProjectFileWriteResult> {
    let mut results = Vec::with_capacity(files.len());

    for file in files {
        let full_path = PathBuf::from(&base_dir).join(&file.path);
        let mut write_result = ProjectFileWriteResult {
            path: file.path.clone(),
            success: false,
            size: 0,
            error: None,
        };

        if let Some(parent) = full_path.parent() {
            if let Err(error) = std::fs::create_dir_all(parent) {
                write_result.error = Some(format!("Failed to create parent directories: {}", error));
                results.push(write_result);
                continue;
            }
        }

        match std::fs::write(&full_path, file.content.as_bytes()) {
            Ok(_) => {
                write_result.success = true;
                write_result.size = file.content.len();
            }
            Err(error) => {
                write_result.error = Some(format!("Failed to write file: {}", error));
            }
        }

        results.push(write_result);
    }

    results
}

// =============================================================================
// Claude Code Implementation
// =============================================================================

/// Find the claude executable by checking common locations
async fn find_claude_path() -> Option<PathBuf> {
    // First try using 'which' with user's shell PATH
    if let Ok(output) = AsyncCommand::new("sh")
        .args(["-l", "-c", "which claude"])
        .output()
        .await
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    // Check common installation locations
    let home = env::var("HOME").unwrap_or_default();
    let common_paths = vec![
        // nvm installations
        format!("{}/.nvm/versions/node/v23.3.0/bin/claude", home),
        format!("{}/.nvm/versions/node/v22.0.0/bin/claude", home),
        format!("{}/.nvm/versions/node/v21.0.0/bin/claude", home),
        format!("{}/.nvm/versions/node/v20.0.0/bin/claude", home),
        // npm global
        format!("{}/node_modules/.bin/claude", home),
        format!("{}/.npm-global/bin/claude", home),
        // Homebrew
        "/opt/homebrew/bin/claude".to_string(),
        "/usr/local/bin/claude".to_string(),
        // bun
        format!("{}/.bun/bin/claude", home),
    ];

    for path in common_paths {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Some(p);
        }
    }

    // Last resort: try PATH directly
    if let Ok(output) = AsyncCommand::new("which").arg("claude").output().await {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    None
}

async fn check_claude_code_impl() -> AgentStatus {
    let claude_path = match find_claude_path().await {
        Some(path) => path,
        None => {
            return AgentStatus {
                installed: false,
                authenticated: false,
                version: None,
                error: Some("Claude Code is not installed. Install it from https://docs.anthropic.com/en/docs/claude-code".to_string()),
                path: None,
            };
        }
    };

    let path_str = claude_path.to_string_lossy().to_string();

    // Get version
    let version_result = AsyncCommand::new(&claude_path)
        .arg("--version")
        .output()
        .await;

    let version = match version_result {
        Ok(output) => {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        }
        Err(_) => None,
    };

    // Check authentication by running a simple command
    let auth_result = AsyncCommand::new(&claude_path)
        .args(["--print", "--output-format", "json", "Say ok"])
        .output()
        .await;

    match auth_result {
        Ok(output) => {
            if output.status.success() {
                AgentStatus {
                    installed: true,
                    authenticated: true,
                    version,
                    error: None,
                    path: Some(path_str),
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
                if stderr.contains("auth") || stderr.contains("login") || stderr.contains("credential") {
                    AgentStatus {
                        installed: true,
                        authenticated: false,
                        version,
                        error: Some("Claude Code is not authenticated. Run \"claude login\" in your terminal".to_string()),
                        path: Some(path_str),
                    }
                } else {
                    AgentStatus {
                        installed: true,
                        authenticated: false,
                        version,
                        error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
                        path: Some(path_str),
                    }
                }
            }
        }
        Err(e) => {
            AgentStatus {
                installed: true,
                authenticated: false,
                version,
                error: Some(format!("Failed to check authentication: {}", e)),
                path: Some(path_str),
            }
        }
    }
}

async fn run_claude_code_impl(prompt: String) -> CommandResult {
    let claude_path = match find_claude_path().await {
        Some(path) => path,
        None => {
            return CommandResult {
                success: false,
                stdout: String::new(),
                stderr: "Claude Code not found".to_string(),
                code: None,
            };
        }
    };

    // Include --dangerously-skip-permissions and --add-dir for full filesystem access
    // Use "--" to separate options from the positional prompt argument
    let result = AsyncCommand::new(&claude_path)
        .args(["--print", "--dangerously-skip-permissions", "--add-dir", "/", "--", &prompt])
        .output()
        .await;

    match result {
        Ok(output) => {
            CommandResult {
                success: output.status.success(),
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                code: output.status.code(),
            }
        }
        Err(e) => {
            CommandResult {
                success: false,
                stdout: String::new(),
                stderr: format!("Failed to run Claude Code: {}", e),
                code: None,
            }
        }
    }
}

/// Stream event sent to frontend
#[derive(Clone, Serialize)]
struct StreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    data: String,
    session_id: String,
}

/// Run Claude Code with streaming output via events
#[tauri::command]
#[allow(non_snake_case)]
async fn run_claude_code_streaming(
    app: tauri::AppHandle,
    prompt: String,
    sessionId: String,
    planMode: Option<bool>,
    thinkingEnabled: Option<bool>,
    workingDirectory: Option<String>,
) -> CommandResult {
    let session_id = sessionId; // Use snake_case internally
    let plan_mode = planMode.unwrap_or(false);
    // Note: thinkingEnabled is a display-only setting handled by the frontend.
    // Claude Code CLI doesn't have a flag to disable extended thinking output.
    // The frontend filters/hides thinking blocks based on this user preference.
    let _thinking_enabled = thinkingEnabled.unwrap_or(true);
    let working_dir = workingDirectory;

    let claude_path = match find_claude_path().await {
        Some(path) => path,
        None => {
            return CommandResult {
                success: false,
                stdout: String::new(),
stderr: "Claude Code not found".to_string(),
                code: None,
            };
        }
    };

    // Build command arguments dynamically based on options
    let mut args = vec!["--print", "--verbose", "--output-format", "stream-json"];

    // Use plan permission mode if enabled, otherwise bypass permissions for agent mode
    if plan_mode {
        args.push("--permission-mode");
        args.push("plan");
    } else {
        args.push("--dangerously-skip-permissions");
    }

    // Add full filesystem access so agents can navigate across the entire codebase
    // This allows agents to access files outside their working directory
    args.push("--add-dir");
    args.push("/");

    // Use "--" to separate options from the positional prompt argument
    // This prevents --add-dir from consuming the prompt as a directory
    args.push("--");
    args.push(&prompt);

    // Use --output-format stream-json for streaming JSON output
    // --verbose is required when using --print with stream-json
    let mut cmd = AsyncCommand::new(&claude_path);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Set working directory if provided
    if let Some(ref dir) = working_dir {
        cmd.current_dir(dir);
    }

    let mut child = match cmd.spawn()
    {
        Ok(child) => child,
        Err(e) => {
            return CommandResult {
                success: false,
                stdout: String::new(),
                stderr: format!("Failed to spawn Claude Code: {}", e),
                code: None,
            };
        }
    };

    let stdout = child.stdout.take().expect("Failed to get stdout");
    let stderr = child.stderr.take().expect("Failed to get stderr");
    let mut reader = BufReader::new(stdout).lines();
    let mut full_output = String::new();

    let stderr_app = app.clone();
    let stderr_session_id = session_id.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut stderr_reader = BufReader::new(stderr).lines();
        let mut full_stderr = String::new();

        while let Ok(Some(line)) = stderr_reader.next_line().await {
            if !line.is_empty() {
                full_stderr.push_str(&line);
                full_stderr.push('\n');
                let _ = stderr_app.emit("claude-stream", StreamEvent {
                    event_type: "stderr".to_string(),
                    data: line,
                    session_id: stderr_session_id.clone(),
                });
            }
        }

        full_stderr
    });

    // Stream each line as an event
    while let Ok(Some(line)) = reader.next_line().await {
        if !line.is_empty() {
            full_output.push_str(&line);
            full_output.push('\n');

            // Emit each line as an event to the frontend
            let _ = app.emit("claude-stream", StreamEvent {
                event_type: "line".to_string(),
                data: line,
                session_id: session_id.clone(),
            });
        }
    }

    // Wait for process to complete
    let status = child.wait().await;
    let (success, exit_code) = match &status {
        Ok(s) => (s.success(), s.code()),
        Err(_) => (false, None),
    };

    let full_stderr = stderr_handle.await.unwrap_or_default();

    if !success {
        let error_message = if !full_stderr.trim().is_empty() {
            format!("Claude Code stream interrupted (exit {:?}): {}", exit_code, full_stderr.trim())
        } else {
            format!("Claude Code stream interrupted (exit {:?})", exit_code)
        };

        let _ = app.emit("claude-stream", StreamEvent {
            event_type: "error".to_string(),
            data: error_message.clone(),
            session_id: session_id.clone(),
        });
    }

    // Emit completion event
    let _ = app.emit("claude-stream", StreamEvent {
        event_type: "done".to_string(),
        data: String::new(),
        session_id: session_id.clone(),
    });

    CommandResult {
        success,
        stdout: full_output,
        stderr: full_stderr,
        code: exit_code,
    }
}

// =============================================================================
// Opencode Implementation
// =============================================================================

/// Find the opencode executable
async fn find_opencode_path() -> Option<PathBuf> {
    // Try using 'which' with user's shell PATH
    if let Ok(output) = AsyncCommand::new("sh")
        .args(["-l", "-c", "which opencode"])
        .output()
        .await
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    // Check common installation locations
    let home = env::var("HOME").unwrap_or_default();
    let common_paths = vec![
        // npm global
        format!("{}/.npm-global/bin/opencode", home),
        format!("{}/node_modules/.bin/opencode", home),
        // Homebrew
        "/opt/homebrew/bin/opencode".to_string(),
        "/usr/local/bin/opencode".to_string(),
        // bun
        format!("{}/.bun/bin/opencode", home),
        // cargo
        format!("{}/.cargo/bin/opencode", home),
    ];

    for path in common_paths {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Some(p);
        }
    }

    None
}

async fn check_opencode_impl() -> AgentStatus {
    let opencode_path = match find_opencode_path().await {
        Some(path) => path,
        None => {
            return AgentStatus {
                installed: false,
                authenticated: false,
                version: None,
                error: Some("Opencode is not installed. Install it from https://github.com/anomalyco/opencode".to_string()),
                path: None,
            };
        }
    };

    let path_str = opencode_path.to_string_lossy().to_string();

    // Get version
    let version_result = AsyncCommand::new(&opencode_path)
        .arg("--version")
        .output()
        .await;

    let version = match version_result {
        Ok(output) => {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        }
        Err(_) => None,
    };

    // Check authentication - opencode uses provider-based auth
    // Try to list models or check auth status
    let auth_result = AsyncCommand::new(&opencode_path)
        .args(["models", "list"])
        .output()
        .await;

    match auth_result {
        Ok(output) => {
            if output.status.success() {
                AgentStatus {
                    installed: true,
                    authenticated: true,
                    version,
                    error: None,
                    path: Some(path_str),
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
                if stderr.contains("auth") || stderr.contains("login") || stderr.contains("api") || stderr.contains("key") {
                    AgentStatus {
                        installed: true,
                        authenticated: false,
                        version,
                        error: Some("Opencode is not authenticated. Run \"opencode auth login --provider anthropic\"".to_string()),
                        path: Some(path_str),
                    }
                } else {
                    // Might just be that auth check command doesn't exist, assume authenticated
                    AgentStatus {
                        installed: true,
                        authenticated: true,
                        version,
                        error: None,
                        path: Some(path_str),
                    }
                }
            }
        }
        Err(_) => {
            // Command might not exist, assume installed but unknown auth status
            AgentStatus {
                installed: true,
                authenticated: true,  // Assume auth is handled separately
                version,
                error: None,
                path: Some(path_str),
            }
        }
    }
}

async fn run_opencode_impl(prompt: String, model: Option<String>) -> CommandResult {
    let opencode_path = match find_opencode_path().await {
        Some(path) => path,
        None => {
            return CommandResult {
                success: false,
                stdout: String::new(),
                stderr: "Opencode not found".to_string(),
                code: None,
            };
        }
    };

    // Build arguments based on whether model is specified
    let mut args = vec!["run".to_string()];

    // Add model flag if specified and not "default"
    if let Some(ref m) = model {
        if m != "default" {
            args.push("--model".to_string());
            args.push(m.clone());
        }
    }

    args.push(prompt);

    // Use opencode's CLI to run a prompt
    // Note: This is a simplified version. Full ACP support would require
    // spawning the ACP server and using JSON-RPC.
    let result = AsyncCommand::new(&opencode_path)
        .args(&args)
        .output()
        .await;

    match result {
        Ok(output) => {
            CommandResult {
                success: output.status.success(),
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                code: output.status.code(),
            }
        }
        Err(e) => {
            CommandResult {
                success: false,
                stdout: String::new(),
                stderr: format!("Failed to run Opencode: {}", e),
                code: None,
            }
        }
    }
}

/// Run Opencode with streaming output via events
#[tauri::command]
#[allow(non_snake_case)]
async fn run_opencode_streaming(
    app: tauri::AppHandle,
    prompt: String,
    sessionId: String,
    model: Option<String>,
    workingDirectory: Option<String>,
) -> CommandResult {
    let session_id = sessionId;
    let working_dir = workingDirectory;

    let opencode_path = match find_opencode_path().await {
        Some(path) => path,
        None => {
            return CommandResult {
                success: false,
                stdout: String::new(),
                stderr: "Opencode not found".to_string(),
                code: None,
            };
        }
    };

    // Build arguments - use run command with streaming output
    let mut args = vec!["run".to_string()];

    // Add model flag if specified and not "default"
    if let Some(ref m) = model {
        if m != "default" {
            args.push("--model".to_string());
            args.push(m.clone());
        }
    }

    // Add streaming format flag for JSON output
    args.push("--format".to_string());
    args.push("json".to_string());

    args.push(prompt);

    let mut cmd = AsyncCommand::new(&opencode_path);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Set working directory if provided
    if let Some(ref dir) = working_dir {
        cmd.current_dir(dir);
    }

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            let err_msg = format!("Failed to spawn Opencode: {}", e);
            let _ = app.emit("opencode-stream", StreamEvent {
                event_type: "error".to_string(),
                data: err_msg.clone(),
                session_id: session_id.clone(),
            });
            return CommandResult {
                success: false,
                stdout: String::new(),
                stderr: err_msg,
                code: None,
            };
        }
    };

    let stdout = child.stdout.take().expect("Failed to get stdout");
    let stderr = child.stderr.take().expect("Failed to get stderr");

    // Spawn task to read stderr and collect it
    let stderr_app = app.clone();
    let stderr_session_id = session_id.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut stderr_reader = BufReader::new(stderr).lines();
        let mut full_stderr = String::new();
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            if !line.is_empty() {
                full_stderr.push_str(&line);
                full_stderr.push('\n');
                // Emit stderr as events
                let _ = stderr_app.emit("opencode-stream", StreamEvent {
                    event_type: "stderr".to_string(),
                    data: line,
                    session_id: stderr_session_id.clone(),
                });
            }
        }
        full_stderr
    });

    // Read stdout in main task
    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut full_output = String::new();

    while let Ok(Some(line)) = stdout_reader.next_line().await {
        if !line.is_empty() {
            full_output.push_str(&line);
            full_output.push('\n');

            // Emit each line as an event to the frontend
            let _ = app.emit("opencode-stream", StreamEvent {
                event_type: "line".to_string(),
                data: line,
                session_id: session_id.clone(),
            });
        }
    }

    // Wait for stderr task to complete
    let full_stderr = stderr_handle.await.unwrap_or_default();

    // Wait for process to complete
    let status = child.wait().await;
    let (success, exit_code) = match &status {
        Ok(s) => (s.success(), s.code()),
        Err(_) => (false, None),
    };

    if !success {
        let error_message = if !full_stderr.trim().is_empty() {
            format!("Opencode stream interrupted (exit {:?}): {}", exit_code, full_stderr.trim())
        } else {
            format!("Opencode stream interrupted (exit {:?})", exit_code)
        };

        let _ = app.emit("opencode-stream", StreamEvent {
            event_type: "error".to_string(),
            data: error_message,
            session_id: session_id.clone(),
        });
    }

    // Emit completion event
    let _ = app.emit("opencode-stream", StreamEvent {
        event_type: "done".to_string(),
        data: if !full_stderr.is_empty() { full_stderr.clone() } else { String::new() },
        session_id: session_id.clone(),
    });

    CommandResult {
        success,
        stdout: full_output,
        stderr: full_stderr,
        code: exit_code,
    }
}

// =============================================================================
// Cursor Agent Implementation
// =============================================================================

/// Find the cursor agent executable
async fn find_cursor_path() -> Option<PathBuf> {
    // Try using 'which' with user's shell PATH
    // Cursor Agent CLI is called 'agent'
    if let Ok(output) = AsyncCommand::new("sh")
        .args(["-l", "-c", "which agent"])
        .output()
        .await
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    // Check common installation locations
    let home = env::var("HOME").unwrap_or_default();
    let common_paths = vec![
        // Cursor typically installs to user's local bin
        format!("{}/.local/bin/agent", home),
        format!("{}/bin/agent", home),
        // Or via npm
        format!("{}/.npm-global/bin/agent", home),
        // Or system paths
        "/usr/local/bin/agent".to_string(),
        "/opt/homebrew/bin/agent".to_string(),
    ];

    for path in common_paths {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Some(p);
        }
    }

    None
}

async fn check_cursor_impl() -> AgentStatus {
    let cursor_path = match find_cursor_path().await {
        Some(path) => path,
        None => {
            return AgentStatus {
                installed: false,
                authenticated: false,
                version: None,
                error: Some("Cursor Agent is not installed. Install it from https://cursor.com/docs/cli".to_string()),
                path: None,
            };
        }
    };

    let path_str = cursor_path.to_string_lossy().to_string();

    // Get version (if available)
    let version_result = AsyncCommand::new(&cursor_path)
        .arg("--version")
        .output()
        .await;

    let version = match version_result {
        Ok(output) => {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        }
        Err(_) => None,
    };

    // Check authentication via 'agent status'
    let auth_result = AsyncCommand::new(&cursor_path)
        .arg("status")
        .output()
        .await;

    match auth_result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();

            if output.status.success() && !stdout.contains("not logged in") && !stdout.contains("unauthenticated") {
                AgentStatus {
                    installed: true,
                    authenticated: true,
                    version,
                    error: None,
                    path: Some(path_str),
                }
            } else if stderr.contains("api_key") || stderr.contains("login") || stdout.contains("not logged") {
                AgentStatus {
                    installed: true,
                    authenticated: false,
                    version,
                    error: Some("Cursor Agent is not authenticated. Run \"agent login\" or set CURSOR_API_KEY".to_string()),
                    path: Some(path_str),
                }
            } else {
                // Check if CURSOR_API_KEY is set
                if env::var("CURSOR_API_KEY").is_ok() {
                    AgentStatus {
                        installed: true,
                        authenticated: true,
                        version,
                        error: None,
                        path: Some(path_str),
                    }
                } else {
                    AgentStatus {
                        installed: true,
                        authenticated: false,
                        version,
                        error: Some("Cursor Agent is not authenticated. Run \"agent login\" or set CURSOR_API_KEY".to_string()),
                        path: Some(path_str),
                    }
                }
            }
        }
        Err(_) => {
            // Status command might not exist, check for API key
            if env::var("CURSOR_API_KEY").is_ok() {
                AgentStatus {
                    installed: true,
                    authenticated: true,
                    version,
                    error: None,
                    path: Some(path_str),
                }
            } else {
                AgentStatus {
                    installed: true,
                    authenticated: false,
                    version,
                    error: Some("Cursor Agent requires authentication. Run \"agent login\" or set CURSOR_API_KEY".to_string()),
                    path: Some(path_str),
                }
            }
        }
    }
}

async fn run_cursor_impl(prompt: String, model: Option<String>, working_dir: Option<String>) -> CommandResult {
    let cursor_path = match find_cursor_path().await {
        Some(path) => path,
        None => {
            return CommandResult {
                success: false,
                stdout: String::new(),
                stderr: "Cursor Agent not found".to_string(),
                code: None,
            };
        }
    };

    // Build arguments based on whether model is specified
    let mut args = vec!["chat".to_string()];

    // Add model flag if specified and not "default"
    if let Some(ref m) = model {
        if m != "default" {
            args.push("--model".to_string());
            args.push(m.clone());
        }
    }

    args.push(prompt);
    args.push("-p".to_string());
    args.push("--output-format".to_string());
    args.push("stream-json".to_string());

    // Run cursor agent in headless mode with streaming JSON output
    let mut cmd = AsyncCommand::new(&cursor_path);
    cmd.args(&args);

    // Set working directory if provided
    if let Some(ref dir) = working_dir {
        cmd.current_dir(dir);
    }

    let result = cmd.output().await;

    match result {
        Ok(output) => {
            CommandResult {
                success: output.status.success(),
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                code: output.status.code(),
            }
        }
        Err(e) => {
            CommandResult {
                success: false,
                stdout: String::new(),
                stderr: format!("Failed to run Cursor Agent: {}", e),
                code: None,
            }
        }
    }
}

// =============================================================================
// Get Available Models from Agents
// =============================================================================

/// Get available models from opencode
async fn get_opencode_models_impl() -> AvailableModels {
    let opencode_path = match find_opencode_path().await {
        Some(path) => path,
        None => {
            return AvailableModels {
                success: false,
                models: vec![],
                error: Some("Opencode not found".to_string()),
            };
        }
    };

    // Run `opencode models` to get list of available models
    let result = AsyncCommand::new(&opencode_path)
        .args(["models"])
        .output()
        .await;

    match result {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let models = parse_opencode_models(&stdout);

            if !models.is_empty() {
                AvailableModels {
                    success: true,
                    models,
                    error: None,
                }
            } else {
                AvailableModels {
                    success: false,
                    models: vec![],
                    error: Some("No models found in opencode output".to_string()),
                }
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            AvailableModels {
                success: false,
                models: vec![],
                error: Some(format!("opencode models failed: {}", stderr)),
            }
        }
        Err(e) => {
            AvailableModels {
                success: false,
                models: vec![],
                error: Some(format!("Failed to run opencode: {}", e)),
            }
        }
    }
}

/// Parse opencode models list output
/// Handles format: provider/model-id (one per line)
fn parse_opencode_models(output: &str) -> Vec<ModelInfo> {
    let mut models = Vec::new();

    // Parse line by line - opencode outputs "provider/model-id" format
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Skip header lines or non-model lines
        if line.starts_with("ID") || line.starts_with("Model") || line.starts_with("NAME") ||
           line.starts_with("---") || line.starts_with("===") || line.starts_with("Available") ||
           line.starts_with("Usage:") || line.starts_with("Commands:") {
            continue;
        }

        // Handle provider/model-id format (e.g., "anthropic/claude-3-5-haiku-20241022")
        if line.contains('/') {
            let parts: Vec<&str> = line.splitn(2, '/').collect();
            if parts.len() == 2 {
                let provider_raw = parts[0].trim();
                let model_name = parts[1].trim();

                // Map provider to display name
                let provider = match provider_raw.to_lowercase().as_str() {
                    "anthropic" => "Anthropic",
                    "openai" => "OpenAI",
                    "google" => "Google",
                    "opencode" => "Opencode",
                    "deepseek" => "DeepSeek",
                    "mistral" => "Mistral",
                    "cohere" => "Cohere",
                    "amazon" | "bedrock" => "Amazon Bedrock",
                    "azure" => "Azure",
                    "groq" => "Groq",
                    "together" => "Together",
                    "fireworks" => "Fireworks",
                    "replicate" => "Replicate",
                    _ => provider_raw,
                };

                models.push(ModelInfo {
                    id: line.to_string(),  // Full ID like "anthropic/claude-3-5-haiku-20241022"
                    name: model_name.to_string(),  // Just the model name
                    provider: Some(provider.to_string()),
                });
                continue;
            }
        }

        // Fallback: treat the whole line as a model ID
        // Skip if it looks like a command or help text
        if !line.contains(' ') && line.len() > 2 && !line.ends_with(':') {
            models.push(ModelInfo {
                id: line.to_string(),
                name: line.to_string(),
                provider: None,
            });
        }
    }

    models
}

/// Get available models from cursor agent
async fn get_cursor_models_impl() -> AvailableModels {
    let cursor_path = match find_cursor_path().await {
        Some(path) => path,
        None => {
            return AvailableModels {
                success: false,
                models: vec![],
                error: Some("Cursor Agent not found".to_string()),
            };
        }
    };

    // Try `agent models` or `agent models list`
    let result = AsyncCommand::new(&cursor_path)
        .args(["models"])
        .output()
        .await;

    match result {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let models = parse_cursor_models(&stdout);
                AvailableModels {
                    success: true,
                    models,
                    error: None,
                }
            } else {
                // Try alternate command
                let alt_result = AsyncCommand::new(&cursor_path)
                    .args(["models", "list"])
                    .output()
                    .await;

                match alt_result {
                    Ok(alt_output) if alt_output.status.success() => {
                        let stdout = String::from_utf8_lossy(&alt_output.stdout);
                        let models = parse_cursor_models(&stdout);
                        AvailableModels {
                            success: true,
                            models,
                            error: None,
                        }
                    }
                    _ => {
                        // Return a default set of models if command fails
                        AvailableModels {
                            success: true,
                            models: get_default_cursor_models(),
                            error: None,
                        }
                    }
                }
            }
        }
        Err(_) => {
            // Return default models if agent doesn't support model listing
            AvailableModels {
                success: true,
                models: get_default_cursor_models(),
                error: None,
            }
        }
    }
}

/// Parse cursor agent models output
fn parse_cursor_models(output: &str) -> Vec<ModelInfo> {
    let mut models = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Try to parse as JSON first
        if line.starts_with('{') || line.starts_with('[') {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                // Handle array
                if let Some(arr) = json.as_array() {
                    for item in arr {
                        if let Some(id) = item.get("id").or(item.get("model")).and_then(|v| v.as_str()) {
                            let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(id);
                            let provider = item.get("provider").and_then(|v| v.as_str()).map(|s| s.to_string());
                            models.push(ModelInfo {
                                id: id.to_string(),
                                name: name.to_string(),
                                provider,
                            });
                        }
                    }
                    continue;
                }
                // Handle object
                if let Some(id) = json.get("id").or(json.get("model")).and_then(|v| v.as_str()) {
                    let name = json.get("name").and_then(|v| v.as_str()).unwrap_or(id);
                    let provider = json.get("provider").and_then(|v| v.as_str()).map(|s| s.to_string());
                    models.push(ModelInfo {
                        id: id.to_string(),
                        name: name.to_string(),
                        provider,
                    });
                    continue;
                }
            }
        }

        // Parse plain text output
        let model_id = line.trim_start_matches('-').trim_start_matches('*').trim();
        if !model_id.is_empty() && model_id.len() > 2 {
            let provider = if model_id.contains("claude") {
                Some("Anthropic".to_string())
            } else if model_id.contains("gpt") || model_id.contains("o1") || model_id.contains("o3") {
                Some("OpenAI".to_string())
            } else if model_id.contains("gemini") {
                Some("Google".to_string())
            } else {
                None
            };

            models.push(ModelInfo {
                id: model_id.to_string(),
                name: model_id.to_string(),
                provider,
            });
        }
    }

    // If no models were parsed, return defaults
    if models.is_empty() {
        return get_default_cursor_models();
    }

    models
}

/// Default cursor models (fallback if agent doesn't support listing)
fn get_default_cursor_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "claude-sonnet-4-20250514".to_string(),
            name: "Claude Sonnet 4".to_string(),
            provider: Some("Anthropic".to_string()),
        },
        ModelInfo {
            id: "claude-opus-4-20250514".to_string(),
            name: "Claude Opus 4".to_string(),
            provider: Some("Anthropic".to_string()),
        },
        ModelInfo {
            id: "gpt-4.1".to_string(),
            name: "GPT-4.1".to_string(),
            provider: Some("OpenAI".to_string()),
        },
        ModelInfo {
            id: "o3".to_string(),
            name: "o3".to_string(),
            provider: Some("OpenAI".to_string()),
        },
        ModelInfo {
            id: "gemini-2.5-pro".to_string(),
            name: "Gemini 2.5 Pro".to_string(),
            provider: Some("Google".to_string()),
        },
    ]
}

/// Get available models for any supported agent
#[tauri::command]
async fn get_agent_models(agent_id: String) -> AvailableModels {
    match agent_id.as_str() {
        "opencode" => get_opencode_models_impl().await,
        "cursor" => get_cursor_models_impl().await,
        "claude-code" => {
            // Claude Code doesn't support model selection
            AvailableModels {
                success: true,
                models: vec![],
                error: Some("Claude Code uses its own model".to_string()),
            }
        }
        _ => AvailableModels {
            success: false,
            models: vec![],
            error: Some(format!("Unknown agent: {}", agent_id)),
        }
    }
}

// =============================================================================
// Generic Agent Commands
// =============================================================================

/// Check the status of any supported agent
#[tauri::command]
async fn check_agent(agent_id: String) -> AgentStatus {
    match agent_id.as_str() {
        "claude-code" => check_claude_code_impl().await,
        "opencode" => check_opencode_impl().await,
        "cursor" => check_cursor_impl().await,
        _ => AgentStatus {
            installed: false,
            authenticated: false,
            version: None,
            error: Some(format!("Unknown agent: {}", agent_id)),
            path: None,
        }
    }
}

/// Run a prompt with any supported agent
#[tauri::command]
#[allow(non_snake_case)]
async fn run_agent(agent_id: String, prompt: String, model: Option<String>, workingDirectory: Option<String>) -> CommandResult {
    match agent_id.as_str() {
        "claude-code" => run_claude_code_impl(prompt).await,
        "opencode" => run_opencode_impl(prompt, model).await,
        "cursor" => run_cursor_impl(prompt, model, workingDirectory).await,
        _ => CommandResult {
            success: false,
            stdout: String::new(),
            stderr: format!("Unknown agent: {}", agent_id),
            code: Some(1),
        }
    }
}

// =============================================================================
// Legacy Commands (for backwards compatibility)
// =============================================================================

/// Legacy: Check Claude Code status
/// Deprecated: Use check_agent("claude-code") instead
#[tauri::command]
async fn check_claude_code() -> AgentStatus {
    check_claude_code_impl().await
}

/// Legacy: Run Claude Code
/// Deprecated: Use run_agent("claude-code", prompt) instead
#[tauri::command]
async fn run_claude_code(prompt: String) -> CommandResult {
    run_claude_code_impl(prompt).await
}

// =============================================================================
// Webview Navigation Commands
// =============================================================================

/// Navigate a webview by executing JavaScript (history.back/forward)
#[tauri::command]
async fn webview_navigate(app: tauri::AppHandle, webview_label: String, direction: String) -> Result<(), String> {
    let webview = app.get_webview(&webview_label)
        .ok_or_else(|| format!("Webview '{}' not found", webview_label))?;

    let script = match direction.as_str() {
        "back" => "history.back()",
        "forward" => "history.forward()",
        _ => return Err(format!("Invalid direction: {}. Use 'back' or 'forward'", direction)),
    };

    webview.eval(script)
        .map_err(|e| format!("Failed to execute navigation: {}", e))
}


// =============================================================================
// File Tree Commands
// =============================================================================
/// Read a directory tree recursively for the file tree sidebar.
/// Delegates to the existing list_directory_files logic from git.rs.
/// Skips hidden files (starting with '.'), node_modules, target, .git.
/// Sorts directories first, then files, both alphabetically.
/// Max depth: 10 levels.
#[tauri::command]
async fn read_directory_tree(path: String) -> Result<Vec<git::FileEntry>, String> {
    list_directory_files(path, Some(10), Some(false)).await
}

// =============================================================================
// Design Page Proxy (strips X-Frame-Options for iframe embedding)
// =============================================================================
/// Headers that block iframe embedding — stripped by the proxy
const BLOCKED_HEADERS: &[&str] = &[
    "x-frame-options",
    "content-security-policy",
    "x-content-type-options",
];
/// Transport headers that don't apply after reqwest decompresses the body
const TRANSPORT_HEADERS: &[&str] = &[
    "content-encoding",
    "transfer-encoding",
    "content-length",
];
fn should_rewrite_content(content_type: &str) -> bool {
    let ct = content_type.to_lowercase();
    ct.starts_with("text/") || ct.contains("javascript") || ct.contains("json")
}
/// JavaScript injected into proxied HTML to intercept dynamically-created iframes
/// and rewrite their src from p.superdesign.dev to our proxy.
const PROXY_REWRITE_SCRIPT: &str = r#"<script>
(function(){
  var P='https://p.superdesign.dev',R='hatch-proxy://localhost/__p';
  function rw(u){if(!u)return u;if(u.indexOf(P)===0)return R+u.substring(P.length);if(u.indexOf('//p.superdesign.dev')===0)return R+u.substring('//p.superdesign.dev'.length);return u;}
  var d=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'src');
  if(d&&d.set){Object.defineProperty(HTMLIFrameElement.prototype,'src',{get:d.get,set:function(v){d.set.call(this,rw(v));},configurable:true});}
  var sa=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(n,v){if(n==='src'&&this.tagName==='IFRAME')return sa.call(this,n,rw(v));return sa.call(this,n,v);};
  new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(node){
    if(node.nodeType!==1)return;
    var frames=node.tagName==='IFRAME'?[node]:Array.prototype.slice.call(node.querySelectorAll?node.querySelectorAll('iframe[src]'):[]);
    frames.forEach(function(f){var s=f.getAttribute('src');if(s){var r=rw(s);if(r!==s)f.setAttribute('src',r);}});
  });});}).observe(document.documentElement,{childList:true,subtree:true});
})();
</script>"#;

fn rewrite_proxy_urls(raw_body: Vec<u8>) -> Vec<u8> {
    String::from_utf8(raw_body)
        .map(|text| {
            text.replace("https://p.superdesign.dev", "hatch-proxy://localhost/__p")
                .replace("http://p.superdesign.dev", "hatch-proxy://localhost/__p")
                .replace("//p.superdesign.dev", "//localhost/__p")
                .into_bytes()
        })
        .unwrap_or_else(|e| e.into_bytes())
}
fn inject_rewrite_script(body: Vec<u8>) -> Vec<u8> {
    if let Ok(html) = String::from_utf8(body) {
        if let Some(pos) = html.find("<head") {
            if let Some(close) = html[pos..].find('>') {
                let inject_at = pos + close + 1;
                let mut result = String::with_capacity(html.len() + PROXY_REWRITE_SCRIPT.len());
                result.push_str(&html[..inject_at]);
                result.push_str(PROXY_REWRITE_SCRIPT);
                result.push_str(&html[inject_at..]);
                return result.into_bytes();
            }
        }
        html.into_bytes()
    } else {
        Vec::new()
    }
}
async fn proxy_fetch(client: &reqwest::Client, url: &str) -> http::Response<Vec<u8>> {
    match client.get(url).send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let mut headers: Vec<(String, String)> = Vec::new();
            for (name, value) in resp.headers() {
                let name_lower = name.as_str().to_lowercase();
                if BLOCKED_HEADERS.contains(&name_lower.as_str()) {
                    continue;
                }
                if TRANSPORT_HEADERS.contains(&name_lower.as_str()) {
                    continue;
                }
                if let Ok(v) = value.to_str() {
                    headers.push((name.as_str().to_string(), v.to_string()));
                }
            }
            let raw_body = resp.bytes().await.unwrap_or_default().to_vec();
            let content_type = headers.iter()
                .find(|(n, _)| n.eq_ignore_ascii_case("content-type"))
                .map(|(_, v)| v.as_str())
                .unwrap_or("");
            let is_html = content_type.contains("text/html");
            let body = if should_rewrite_content(content_type) {
                let rewritten = rewrite_proxy_urls(raw_body);
                if is_html {
                    inject_rewrite_script(rewritten)
                } else {
                    rewritten
                }
            } else {
                raw_body
            };
            let mut builder = http::Response::builder()
                .status(status)
                .header("access-control-allow-origin", "*");
            for (name, value) in &headers {
                builder = builder.header(name.as_str(), value.as_str());
            }
            builder.body(body).unwrap_or_else(|_| {
                http::Response::builder()
                    .status(500)
                    .header("content-type", "text/plain")
                    .body(b"Failed to build proxy response".to_vec())
                    .unwrap()
            })
        }
        Err(e) => {
            http::Response::builder()
                .status(502)
                .header("content-type", "text/plain")
                .body(format!("Proxy error: {}", e).into_bytes())
                .unwrap()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;

    fn queued(id: &str, priority: GitOperationPriority) -> QueuedGitOperation {
        let (tx, _rx) = tokio::sync::oneshot::channel::<Result<serde_json::Value, String>>();
        QueuedGitOperation {
            operation: GitCoordinatorOperation {
                id: id.to_string(),
                operation_type: "test".to_string(),
                repo_root: "/tmp/repo".to_string(),
                command: "git_status".to_string(),
                priority,
                enqueued_at: 0,
                started_at: None,
                completed_at: None,
                error: None,
            },
            params: serde_json::json!({}),
            result_tx: Some(tx),
        }
    }

    #[test]
    fn queue_inserts_critical_before_normal_and_low() {
        let mut queue = VecDeque::new();
        queue_insert_by_priority(&mut queue, queued("normal-1", GitOperationPriority::Normal));
        queue_insert_by_priority(&mut queue, queued("low-1", GitOperationPriority::Low));
        queue_insert_by_priority(&mut queue, queued("critical-1", GitOperationPriority::Critical));

        let ids: Vec<String> = queue.iter().map(|item| item.operation.id.clone()).collect();
        assert_eq!(ids, vec!["critical-1", "normal-1", "low-1"]);
    }

    #[test]
    fn queue_preserves_fifo_within_same_priority() {
        let mut queue = VecDeque::new();
        queue_insert_by_priority(&mut queue, queued("critical-1", GitOperationPriority::Critical));
        queue_insert_by_priority(&mut queue, queued("critical-2", GitOperationPriority::Critical));
        queue_insert_by_priority(&mut queue, queued("normal-1", GitOperationPriority::Normal));
        queue_insert_by_priority(&mut queue, queued("normal-2", GitOperationPriority::Normal));
        queue_insert_by_priority(&mut queue, queued("low-1", GitOperationPriority::Low));
        queue_insert_by_priority(&mut queue, queued("low-2", GitOperationPriority::Low));

        let ids: Vec<String> = queue.iter().map(|item| item.operation.id.clone()).collect();
        assert_eq!(
            ids,
            vec![
                "critical-1",
                "critical-2",
                "normal-1",
                "normal-2",
                "low-1",
                "low-2"
            ]
        );
    }

    fn run_git_sync(repo: &str, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(args)
            .output()
            .expect("git command should run in test");

        assert!(
            output.status.success(),
            "git command failed: git -C {} {}\nstdout: {}\nstderr: {}",
            repo,
            args.join(" "),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn run_git_no_repo(args: &[&str]) {
        let output = Command::new("git")
            .args(args)
            .output()
            .expect("git command should run in test");

        assert!(
            output.status.success(),
            "git command failed: git {}\nstdout: {}\nstderr: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[tokio::test]
    async fn worktree_lifecycle_create_lock_unlock_remove_cycle() {
        let test_root = std::env::temp_dir().join(format!(
            "hatch-worktree-lifecycle-{}",
            unix_timestamp_ms()
        ));
        let origin_path = test_root.join("origin.git");
        let repo_path = test_root.join("repo");

        fs::create_dir_all(&test_root).expect("test root should be created");
        run_git_no_repo(&["init", "--bare", origin_path.to_str().unwrap_or_default()]);
        run_git_no_repo(&[
            "clone",
            origin_path.to_str().unwrap_or_default(),
            repo_path.to_str().unwrap_or_default(),
        ]);

        let repo = repo_path.to_string_lossy().to_string();
        run_git_sync(&repo, &["config", "user.email", "worktree-test@example.com"]);
        run_git_sync(&repo, &["config", "user.name", "Worktree Test"]);

        fs::write(repo_path.join("README.md"), "# lifecycle\n").expect("seed file should be written");
        run_git_sync(&repo, &["add", "README.md"]);
        run_git_sync(&repo, &["commit", "-m", "seed"]);
        run_git_sync(&repo, &["branch", "-M", "main"]);
        run_git_sync(&repo, &["push", "-u", "origin", "main"]);

        let manager = WorktreeLifecycleManager::new();
        let create_result = manager
            .create(WorktreeCreateRequest {
                repo_root: repo.clone(),
                workspace_id: "alpha".to_string(),
            })
            .await
            .expect("worktree should be created");

        assert_eq!(create_result.branch_name, "workspace/alpha");
        assert!(Path::new(&create_result.worktree_path).exists());
        assert!(create_result.is_locked);

        let listed = manager
            .list(&repo)
            .await
            .expect("worktrees should be listed");
        let entry = listed
            .iter()
            .find(|item| item.branch == "workspace/alpha")
            .expect("created worktree should be listed");

        assert_eq!(entry.branch, "workspace/alpha");
        assert!(entry.is_locked);
        assert!(matches!(entry.health_status, WorktreeHealthStatus::Locked));

        manager
            .remove(WorktreeRemoveRequest {
                repo_root: repo.clone(),
                worktree_path: create_result.worktree_path.clone(),
                branch_name: Some(create_result.branch_name.clone()),
            })
            .await
            .expect("worktree should be removed");

        assert!(!Path::new(&create_result.worktree_path).exists());
        let branch_query = Command::new("git")
            .arg("-C")
            .arg(&repo)
            .args(["branch", "--list", "workspace/alpha"])
            .output()
            .expect("branch list should run");
        assert!(String::from_utf8_lossy(&branch_query.stdout).trim().is_empty());

        let _ = fs::remove_dir_all(test_root);
    }
}
// =============================================================================
// Application Entry Point
// =============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared HTTP client for the design page proxy (reqwest::Client uses Arc internally)
    let proxy_client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    tauri::Builder::default()
        .manage(GitCoordinator::new())
        .manage(WorktreeLifecycleManager::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let manager = app.state::<WorktreeLifecycleManager>().inner().clone();
            tauri::async_runtime::spawn(async move {
                manager.repair_all_known_repos().await;
            });
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("hatch-proxy", move |_ctx, request, responder| {
            let client = proxy_client.clone();
            let uri = request.uri().clone();
            let path = uri.path().to_string();
            let query = uri.query().map(|q| q.to_string());
            let (host, effective_path) = if let Some(rest) = path.strip_prefix("/__p") {
                let ep = if rest.is_empty() || rest == "/" {
                    "/".to_string()
                } else {
                    rest.to_string()
                };
                ("p.superdesign.dev", ep)
            } else {
                ("app.superdesign.dev", path)
            };

            let target_url = match query {
                Some(ref q) => format!("https://{}{}?{}", host, effective_path, q),
                None => format!("https://{}{}", host, effective_path),
            };
            tauri::async_runtime::spawn(async move {
                let response = proxy_fetch(&client, &target_url).await;
                responder.respond(response);
            });
        })
        .invoke_handler(tauri::generate_handler![
            // Generic agent commands
            check_agent,
            run_agent,
            get_agent_models,
            // Legacy Claude Code commands (backwards compatibility)
            check_claude_code,
            run_claude_code,
            run_claude_code_streaming,
            // Opencode streaming
            run_opencode_streaming,
            // GitHub auth commands
            github_check_gh_installed,
            github_login,
            github_get_auth_state,
            github_sign_out,
            github_validate_token,
            // Git commands
            git_coordinator_enqueue,
            git_coordinator_status,
            git_coordinator_cancel,
            worktree_create,
            worktree_remove,
            worktree_repair,
            worktree_list,
            git_clone_repo,
            git_open_local_repo,
            git_create_workspace_branch,
            git_delete_workspace_branch,
            git_list_worktrees,
            git_prune_worktrees,
            git_status,
            git_commit,
            git_push,
            git_create_pr,
            git_create_github_repo,
            git_diff,
            git_diff_stats,
            list_directory_files,
            read_file,
            git_file_diff,
            git_get_pr,
            git_merge_pr,
            // Keychain commands
            keychain_set,
            keychain_get,
            keychain_delete,
            keychain_has,
            // Skill installation commands
            install_skill,
            uninstall_skill,
            list_installed_skills,
            is_skill_installed,
            get_skill_install_path,
            run_shell_command,
            write_project_files,
            // Webview navigation
            webview_navigate,
            // File tree
            read_directory_tree
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
