use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::process::Command as AsyncCommand;

use crate::github::get_access_token;

const WORKSPACES_DIR: &str = ".hatch/workspaces";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: String,
    pub name: String,
    pub full_name: String, // owner/repo
    pub clone_url: String,
    pub local_path: String,
    pub default_branch: String,
    pub is_private: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub staged: Vec<String>,
    pub modified: Vec<String>,
    pub untracked: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneProgress {
    pub stage: String, // "counting", "compressing", "receiving", "resolving", "done"
    pub percent: u32,
}

/// Get the base workspaces directory
pub fn get_workspaces_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    Ok(home.join(WORKSPACES_DIR))
}

/// Clone a repository from GitHub
#[tauri::command]
pub async fn git_clone_repo(repo_url: String, repo_name: String) -> Result<Repository, String> {
    let workspaces_dir = get_workspaces_dir()?;

    // Create workspaces directory if it doesn't exist
    std::fs::create_dir_all(&workspaces_dir)
        .map_err(|e| format!("Failed to create workspaces directory: {}", e))?;

    let local_path = workspaces_dir.join(&repo_name);

    // Check if already cloned
    if local_path.exists() {
        return Err(format!("Repository '{}' already exists at {:?}", repo_name, local_path));
    }

    // Build clone URL with token if available
    let clone_url = if let Some(token) = get_access_token() {
        // Convert https://github.com/owner/repo to https://token@github.com/owner/repo
        if repo_url.starts_with("https://github.com/") {
            repo_url.replace("https://github.com/", &format!("https://{}@github.com/", token))
        } else {
            repo_url.clone()
        }
    } else {
        repo_url.clone()
    };

    // Clone the repository
    let output = AsyncCommand::new("git")
        .args(["clone", &clone_url, local_path.to_str().unwrap()])
        .output()
        .await
        .map_err(|e| format!("Failed to run git clone: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed: {}", stderr));
    }

    // Get default branch
    let default_branch = get_default_branch(&local_path).await?;

    // Parse repo info from URL
    let full_name = parse_repo_full_name(&repo_url)?;

    Ok(Repository {
        id: uuid::Uuid::new_v4().to_string(),
        name: repo_name,
        full_name,
        clone_url: repo_url,
        local_path: local_path.to_string_lossy().to_string(),
        default_branch,
        is_private: false, // We'll determine this from GitHub API if needed
    })
}

/// Open an existing local repository
#[tauri::command]
pub async fn git_open_local_repo(path: String) -> Result<Repository, String> {
    let repo_path = PathBuf::from(&path);

    if !repo_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    // Check if it's a git repo
    let git_dir = repo_path.join(".git");
    if !git_dir.exists() {
        return Err(format!("Not a git repository: {}", path));
    }

    // Get remote URL
    let output = AsyncCommand::new("git")
        .args(["-C", &path, "remote", "get-url", "origin"])
        .output()
        .await
        .map_err(|e| format!("Failed to get remote URL: {}", e))?;

    let clone_url = if output.status.success() {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        String::new()
    };

    // Get repo name from path
    let name = repo_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    // Get default branch
    let default_branch = get_default_branch(&repo_path).await.unwrap_or_else(|_| "main".to_string());

    // Parse full name from URL if available
    let full_name = if !clone_url.is_empty() {
        parse_repo_full_name(&clone_url).unwrap_or_else(|_| name.clone())
    } else {
        name.clone()
    };

    Ok(Repository {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        full_name,
        clone_url,
        local_path: path,
        default_branch,
        is_private: false,
    })
}

/// Result from creating a workspace with worktree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceResult {
    pub branch_name: String,
    pub worktree_path: String,
}

/// Create a new workspace with its own worktree for isolation
#[tauri::command]
pub async fn git_create_workspace_branch(repo_path: String, workspace_id: String) -> Result<WorkspaceResult, String> {
    let branch_name = format!("workspace/{}", workspace_id);
    let repo_path_buf = PathBuf::from(&repo_path);

    // Create worktrees directory inside the repo's parent workspace folder
    // Structure: ~/.hatch/workspaces/{repo_name}/worktrees/{workspace_id}
    let worktrees_dir = repo_path_buf.join("worktrees");
    let worktree_path = worktrees_dir.join(&workspace_id);

    std::fs::create_dir_all(&worktrees_dir)
        .map_err(|e| format!("Failed to create worktrees directory: {}", e))?;

    // Fetch latest from origin first
    let _ = AsyncCommand::new("git")
        .args(["-C", &repo_path, "fetch", "origin"])
        .output()
        .await;

    // Get the default branch
    let default_branch = get_default_branch(&repo_path_buf).await?;

    // Create a new branch for the workspace
    let branch_output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "branch", &branch_name, &format!("origin/{}", default_branch)])
        .output()
        .await
        .map_err(|e| format!("Failed to create branch: {}", e))?;

    if !branch_output.status.success() {
        let stderr = String::from_utf8_lossy(&branch_output.stderr);
        // Branch might already exist, that's ok
        if !stderr.contains("already exists") {
            return Err(format!("Failed to create branch: {}", stderr));
        }
    }

    // Create a worktree for this workspace
    let worktree_output = AsyncCommand::new("git")
        .args([
            "-C", &repo_path,
            "worktree", "add",
            worktree_path.to_str().unwrap(),
            &branch_name
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to create worktree: {}", e))?;

    if !worktree_output.status.success() {
        let stderr = String::from_utf8_lossy(&worktree_output.stderr);
        return Err(format!("Failed to create worktree: {}", stderr));
    }

    Ok(WorkspaceResult {
        branch_name,
        worktree_path: worktree_path.to_string_lossy().to_string(),
    })
}

/// Get git status for a repository
#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<GitStatus, String> {
    // Get current branch
    let branch_output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "branch", "--show-current"])
        .output()
        .await
        .map_err(|e| format!("Failed to get branch: {}", e))?;

    let branch = String::from_utf8_lossy(&branch_output.stdout).trim().to_string();

    // Get status
    let status_output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "status", "--porcelain"])
        .output()
        .await
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let status_str = String::from_utf8_lossy(&status_output.stdout);

    let mut staged = Vec::new();
    let mut modified = Vec::new();
    let mut untracked = Vec::new();

    for line in status_str.lines() {
        if line.len() < 3 {
            continue;
        }
        let index_status = line.chars().next().unwrap_or(' ');
        let worktree_status = line.chars().nth(1).unwrap_or(' ');
        let file = line[3..].to_string();

        match (index_status, worktree_status) {
            ('?', '?') => untracked.push(file),
            (' ', 'M') | (' ', 'D') => modified.push(file),
            ('M', _) | ('A', _) | ('D', _) | ('R', _) => staged.push(file),
            _ => {}
        }
    }

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&repo_path, &branch).await.unwrap_or((0, 0));

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        staged,
        modified,
        untracked,
    })
}

/// Commit all changes with the given message
#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    // Stage all changes
    let add_output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "add", "-A"])
        .output()
        .await
        .map_err(|e| format!("Failed to stage changes: {}", e))?;

    if !add_output.status.success() {
        let stderr = String::from_utf8_lossy(&add_output.stderr);
        return Err(format!("Failed to stage changes: {}", stderr));
    }

    // Commit
    let commit_output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "commit", "-m", &message])
        .output()
        .await
        .map_err(|e| format!("Failed to commit: {}", e))?;

    if !commit_output.status.success() {
        let stderr = String::from_utf8_lossy(&commit_output.stderr);
        // Check if there's nothing to commit
        if stderr.contains("nothing to commit") {
            return Ok("Nothing to commit".to_string());
        }
        return Err(format!("Failed to commit: {}", stderr));
    }

    // Get commit hash
    let hash_output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "rev-parse", "--short", "HEAD"])
        .output()
        .await
        .map_err(|e| format!("Failed to get commit hash: {}", e))?;

    let hash = String::from_utf8_lossy(&hash_output.stdout).trim().to_string();
    Ok(hash)
}

/// Push changes to remote
#[tauri::command]
pub async fn git_push(repo_path: String, branch: String) -> Result<(), String> {
    // Set upstream and push
    let output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "push", "-u", "origin", &branch])
        .output()
        .await
        .map_err(|e| format!("Failed to push: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to push: {}", stderr));
    }

    Ok(())
}

/// Create a pull request using GitHub API
#[tauri::command]
pub async fn git_create_pr(
    repo_full_name: String,
    head_branch: String,
    base_branch: String,
    title: String,
    body: String,
) -> Result<String, String> {
    let token = get_access_token()
        .ok_or("Not authenticated with GitHub. Please sign in first.")?;

    let client = reqwest::Client::new();

    #[derive(Serialize)]
    struct CreatePRRequest {
        title: String,
        body: String,
        head: String,
        base: String,
    }

    #[derive(Deserialize)]
    struct CreatePRResponse {
        html_url: String,
    }

    let response = client
        .post(format!("https://api.github.com/repos/{}/pulls", repo_full_name))
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "hatch-desktop")
        .header("Accept", "application/vnd.github.v3+json")
        .json(&CreatePRRequest {
            title,
            body,
            head: head_branch,
            base: base_branch,
        })
        .send()
        .await
        .map_err(|e| format!("Failed to create PR: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("GitHub API error: {}", error_text));
    }

    let pr_response: CreatePRResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse PR response: {}", e))?;

    Ok(pr_response.html_url)
}

/// Create a new GitHub repository
#[tauri::command]
pub async fn git_create_github_repo(name: String, is_private: bool) -> Result<Repository, String> {
    let token = get_access_token()
        .ok_or("Not authenticated with GitHub. Please sign in first.")?;

    let client = reqwest::Client::new();

    #[derive(Serialize)]
    struct CreateRepoRequest {
        name: String,
        private: bool,
        auto_init: bool, // Initialize with README
    }

    #[derive(Deserialize)]
    struct CreateRepoResponse {
        id: i64,
        name: String,
        full_name: String,
        clone_url: String,
        default_branch: String,
        private: bool,
    }

    let response = client
        .post("https://api.github.com/user/repos")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "hatch-desktop")
        .header("Accept", "application/vnd.github.v3+json")
        .json(&CreateRepoRequest {
            name: name.clone(),
            private: is_private,
            auto_init: true,
        })
        .send()
        .await
        .map_err(|e| format!("Failed to create repository: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("GitHub API error: {}", error_text));
    }

    let repo_response: CreateRepoResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Clone the newly created repo
    let workspaces_dir = get_workspaces_dir()?;
    let local_path = workspaces_dir.join(&name);

    std::fs::create_dir_all(&workspaces_dir)
        .map_err(|e| format!("Failed to create workspaces directory: {}", e))?;

    // Clone with token authentication
    let clone_url = repo_response.clone_url.replace(
        "https://github.com/",
        &format!("https://{}@github.com/", token),
    );

    let output = AsyncCommand::new("git")
        .args(["clone", &clone_url, local_path.to_str().unwrap()])
        .output()
        .await
        .map_err(|e| format!("Failed to clone repository: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to clone repository: {}", stderr));
    }

    Ok(Repository {
        id: repo_response.id.to_string(),
        name: repo_response.name,
        full_name: repo_response.full_name,
        clone_url: repo_response.clone_url,
        local_path: local_path.to_string_lossy().to_string(),
        default_branch: repo_response.default_branch,
        is_private: repo_response.private,
    })
}

/// Information about a git worktree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub path: String,
    pub head: String,
    pub branch: Option<String>,
    pub is_bare: bool,
    pub is_detached: bool,
    pub is_locked: bool,
    pub is_prunable: bool,
}

/// List all worktrees for a repository
#[tauri::command]
pub async fn git_list_worktrees(repo_path: String) -> Result<Vec<WorktreeInfo>, String> {
    // Run git worktree list with porcelain output for easier parsing
    let output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "worktree", "list", "--porcelain"])
        .output()
        .await
        .map_err(|e| format!("Failed to list worktrees: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to list worktrees: {}", stderr));
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut worktrees = Vec::new();
    let mut current_worktree: Option<WorktreeInfo> = None;

    for line in output_str.lines() {
        if line.starts_with("worktree ") {
            // Save previous worktree if exists
            if let Some(wt) = current_worktree.take() {
                worktrees.push(wt);
            }
            // Start new worktree
            current_worktree = Some(WorktreeInfo {
                path: line.strip_prefix("worktree ").unwrap_or("").to_string(),
                head: String::new(),
                branch: None,
                is_bare: false,
                is_detached: false,
                is_locked: false,
                is_prunable: false,
            });
        } else if let Some(ref mut wt) = current_worktree {
            if line.starts_with("HEAD ") {
                wt.head = line.strip_prefix("HEAD ").unwrap_or("").to_string();
            } else if line.starts_with("branch ") {
                wt.branch = Some(line.strip_prefix("branch ").unwrap_or("").to_string());
            } else if line == "bare" {
                wt.is_bare = true;
            } else if line == "detached" {
                wt.is_detached = true;
            } else if line.starts_with("locked") {
                wt.is_locked = true;
            } else if line.starts_with("prunable") {
                wt.is_prunable = true;
            }
        }
    }

    // Don't forget the last worktree
    if let Some(wt) = current_worktree {
        worktrees.push(wt);
    }

    Ok(worktrees)
}

/// Prune stale worktree references
#[tauri::command]
pub async fn git_prune_worktrees(repo_path: String) -> Result<String, String> {
    let output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "worktree", "prune", "-v"])
        .output()
        .await
        .map_err(|e| format!("Failed to prune worktrees: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to prune worktrees: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

/// Delete a workspace branch and its worktree
#[tauri::command]
pub async fn git_delete_workspace_branch(repo_path: String, branch_name: String, worktree_path: Option<String>) -> Result<(), String> {
    // If worktree path is provided, remove the worktree first
    if let Some(wt_path) = &worktree_path {
        // Remove the worktree (force to handle any uncommitted changes)
        let remove_output = AsyncCommand::new("git")
            .args(["-C", &repo_path, "worktree", "remove", "--force", wt_path])
            .output()
            .await
            .map_err(|e| format!("Failed to remove worktree: {}", e))?;

        if !remove_output.status.success() {
            let stderr = String::from_utf8_lossy(&remove_output.stderr);
            // If worktree doesn't exist, that's fine - continue to delete branch
            if !stderr.contains("is not a working tree") && !stderr.contains("No such file") {
                // Try to just delete the directory manually as fallback
                let _ = std::fs::remove_dir_all(wt_path);
            }
        }

        // Prune any stale worktree references
        let _ = AsyncCommand::new("git")
            .args(["-C", &repo_path, "worktree", "prune"])
            .output()
            .await;
    }

    // Delete the branch locally (force delete to handle any state)
    let delete_output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "branch", "-D", &branch_name])
        .output()
        .await
        .map_err(|e| format!("Failed to delete branch: {}", e))?;

    if !delete_output.status.success() {
        let stderr = String::from_utf8_lossy(&delete_output.stderr);
        // If branch doesn't exist, that's fine
        if !stderr.contains("not found") && !stderr.contains("error: branch") {
            return Err(format!("Failed to delete branch: {}", stderr));
        }
    }

    Ok(())
}

/// Get the diff for a repository
#[tauri::command]
pub async fn git_diff(repo_path: String) -> Result<String, String> {
    // Get both staged and unstaged diff
    let staged = AsyncCommand::new("git")
        .args(["-C", &repo_path, "diff", "--cached"])
        .output()
        .await
        .map_err(|e| format!("Failed to get staged diff: {}", e))?;

    let unstaged = AsyncCommand::new("git")
        .args(["-C", &repo_path, "diff"])
        .output()
        .await
        .map_err(|e| format!("Failed to get unstaged diff: {}", e))?;

    let staged_str = String::from_utf8_lossy(&staged.stdout);
    let unstaged_str = String::from_utf8_lossy(&unstaged.stdout);

    Ok(format!("{}\n{}", staged_str, unstaged_str))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub additions: u32,
    pub deletions: u32,
    pub status: String, // "modified", "added", "deleted", "renamed", "untracked"
}

/// Get detailed diff stats for each changed file
#[tauri::command]
pub async fn git_diff_stats(repo_path: String) -> Result<Vec<FileChange>, String> {
    let mut changes: Vec<FileChange> = Vec::new();

    // Get status with porcelain to identify file states
    let status_output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "status", "--porcelain"])
        .output()
        .await
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let status_str = String::from_utf8_lossy(&status_output.stdout);

    // Collect file paths and their statuses
    let mut file_statuses: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for line in status_str.lines() {
        if line.len() < 3 {
            continue;
        }
        let index_status = line.chars().next().unwrap_or(' ');
        let worktree_status = line.chars().nth(1).unwrap_or(' ');
        let file = line[3..].to_string();

        let status = match (index_status, worktree_status) {
            ('?', '?') => "untracked",
            ('A', _) => "added",
            ('D', _) | (_, 'D') => "deleted",
            ('R', _) => "renamed",
            _ => "modified",
        };
        file_statuses.insert(file, status.to_string());
    }

    // Get numstat for additions/deletions of tracked files
    let numstat_output = AsyncCommand::new("git")
        .args(["-C", &repo_path, "diff", "--numstat", "HEAD"])
        .output()
        .await
        .map_err(|e| format!("Failed to get diff numstat: {}", e))?;

    let numstat_str = String::from_utf8_lossy(&numstat_output.stdout);

    for line in numstat_str.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let additions = parts[0].parse().unwrap_or(0);
            let deletions = parts[1].parse().unwrap_or(0);
            let path = parts[2].to_string();

            let status = file_statuses.get(&path).cloned().unwrap_or_else(|| "modified".to_string());
            file_statuses.remove(&path);

            changes.push(FileChange {
                path,
                additions,
                deletions,
                status,
            });
        }
    }

    // Add untracked files that weren't in numstat
    for (path, status) in file_statuses {
        if status == "untracked" {
            // Count lines in untracked file
            let file_path = PathBuf::from(&repo_path).join(&path);
            let additions = if file_path.exists() {
                std::fs::read_to_string(&file_path)
                    .map(|c| c.lines().count() as u32)
                    .unwrap_or(0)
            } else {
                0
            };

            changes.push(FileChange {
                path,
                additions,
                deletions: 0,
                status,
            });
        }
    }

    Ok(changes)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileEntry>>,
}

/// List all files in a directory recursively
#[tauri::command]
pub async fn list_directory_files(dir_path: String, max_depth: Option<u32>, show_hidden: Option<bool>) -> Result<Vec<FileEntry>, String> {
    let path = PathBuf::from(&dir_path);
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }

    let depth = max_depth.unwrap_or(10);
    let include_hidden = show_hidden.unwrap_or(false);
    list_dir_recursive(&path, &path, depth, include_hidden)
}

fn list_dir_recursive(base_path: &Path, current_path: &Path, depth: u32, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    if depth == 0 {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();

    let read_dir = std::fs::read_dir(current_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files unless show_hidden is true
        if !show_hidden && name.starts_with('.') {
            continue;
        }

        // Always skip these large directories
        if name == "node_modules" || name == "target" || name == ".git" {
            continue;
        }

        let relative_path = path.strip_prefix(base_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| name.clone());

        let is_directory = path.is_dir();

        let children = if is_directory && depth > 1 {
            Some(list_dir_recursive(base_path, &path, depth - 1, show_hidden)?)
        } else if is_directory {
            Some(Vec::new()) // Empty children if we've hit depth limit
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path: relative_path,
            is_directory,
            children,
        });
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub language: String,
    pub size: u64,
}

/// Read the contents of a file
#[tauri::command]
pub async fn read_file(file_path: String) -> Result<FileContent, String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    if path.is_dir() {
        return Err("Cannot read a directory".to_string());
    }

    // Get file metadata
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    let size = metadata.len();

    // Don't read files larger than 5MB
    if size > 5 * 1024 * 1024 {
        return Err("File is too large to read (max 5MB)".to_string());
    }

    // Read file contents
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Determine language from extension
    let language = path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| match ext.to_lowercase().as_str() {
            "rs" => "rust",
            "ts" | "tsx" => "typescript",
            "js" | "jsx" => "javascript",
            "py" => "python",
            "json" => "json",
            "toml" => "toml",
            "yaml" | "yml" => "yaml",
            "md" => "markdown",
            "html" => "html",
            "css" => "css",
            "scss" | "sass" => "scss",
            "sql" => "sql",
            "sh" | "bash" => "bash",
            "go" => "go",
            "java" => "java",
            "kt" => "kotlin",
            "swift" => "swift",
            "c" | "h" => "c",
            "cpp" | "cc" | "hpp" => "cpp",
            "xml" => "xml",
            "svg" => "svg",
            _ => "plaintext",
        })
        .unwrap_or("plaintext")
        .to_string();

    Ok(FileContent {
        path: file_path,
        content,
        language,
        size,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub path: String,
    pub old_content: String,
    pub new_content: String,
    pub language: String,
    pub is_new_file: bool,
    pub is_deleted: bool,
}

/// Get diff for a specific file (shows old vs new content)
#[tauri::command]
pub async fn git_file_diff(repo_path: String, file_path: String) -> Result<FileDiff, String> {
    let repo = PathBuf::from(&repo_path);

    if !repo.exists() {
        return Err("Repository path does not exist".to_string());
    }

    // Get the relative path from repo root
    let full_file_path = if file_path.starts_with(&repo_path) {
        PathBuf::from(&file_path)
    } else {
        repo.join(&file_path)
    };

    let relative_path = full_file_path.strip_prefix(&repo)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or(file_path.clone());

    // Determine language from extension
    let language = full_file_path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| match ext.to_lowercase().as_str() {
            "rs" => "rust",
            "ts" | "tsx" => "typescript",
            "js" | "jsx" => "javascript",
            "py" => "python",
            "json" => "json",
            "toml" => "toml",
            "yaml" | "yml" => "yaml",
            "md" => "markdown",
            "html" => "html",
            "css" => "css",
            "scss" | "sass" => "scss",
            "sql" => "sql",
            "sh" | "bash" => "bash",
            "go" => "go",
            "java" => "java",
            "kt" => "kotlin",
            "swift" => "swift",
            "c" | "h" => "c",
            "cpp" | "cc" | "hpp" => "cpp",
            "xml" => "xml",
            "svg" => "svg",
            _ => "plaintext",
        })
        .unwrap_or("plaintext")
        .to_string();

    // Check if file is untracked (new file)
    let status_output = AsyncCommand::new("git")
        .args(["-C", repo.to_str().unwrap(), "status", "--porcelain", &relative_path])
        .output()
        .await
        .map_err(|e| format!("Failed to get git status: {}", e))?;

    let status_str = String::from_utf8_lossy(&status_output.stdout);
    let is_new_file = status_str.starts_with("??") || status_str.starts_with("A ");
    let is_deleted = status_str.starts_with(" D") || status_str.starts_with("D ");

    // Get old content (from HEAD)
    let old_content = if is_new_file {
        String::new()
    } else {
        let output = AsyncCommand::new("git")
            .args(["-C", repo.to_str().unwrap(), "show", &format!("HEAD:{}", relative_path)])
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                String::from_utf8_lossy(&out.stdout).to_string()
            }
            _ => String::new()
        }
    };

    // Get new content (current working directory)
    let new_content = if is_deleted {
        String::new()
    } else if full_file_path.exists() {
        std::fs::read_to_string(&full_file_path)
            .unwrap_or_default()
    } else {
        String::new()
    };

    Ok(FileDiff {
        path: relative_path,
        old_content,
        new_content,
        language,
        is_new_file,
        is_deleted,
    })
}

// Helper functions

async fn get_default_branch(repo_path: &Path) -> Result<String, String> {
    // Try to get from remote HEAD
    let output = AsyncCommand::new("git")
        .args(["-C", repo_path.to_str().unwrap(), "symbolic-ref", "refs/remotes/origin/HEAD"])
        .output()
        .await;

    if let Ok(output) = output {
        if output.status.success() {
            let ref_str = String::from_utf8_lossy(&output.stdout);
            if let Some(branch) = ref_str.trim().strip_prefix("refs/remotes/origin/") {
                return Ok(branch.to_string());
            }
        }
    }

    // Fall back to checking if main or master exists
    for branch in &["main", "master"] {
        let output = AsyncCommand::new("git")
            .args(["-C", repo_path.to_str().unwrap(), "rev-parse", "--verify", &format!("origin/{}", branch)])
            .output()
            .await;

        if let Ok(output) = output {
            if output.status.success() {
                return Ok(branch.to_string());
            }
        }
    }

    Ok("main".to_string())
}

async fn get_ahead_behind(repo_path: &str, branch: &str) -> Result<(u32, u32), String> {
    let output = AsyncCommand::new("git")
        .args(["-C", repo_path, "rev-list", "--left-right", "--count", &format!("{}...origin/{}", branch, branch)])
        .output()
        .await
        .map_err(|e| format!("Failed to get ahead/behind: {}", e))?;

    if !output.status.success() {
        return Ok((0, 0));
    }

    let counts = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = counts.trim().split('\t').collect();

    if parts.len() == 2 {
        let ahead = parts[0].parse().unwrap_or(0);
        let behind = parts[1].parse().unwrap_or(0);
        return Ok((ahead, behind));
    }

    Ok((0, 0))
}

fn parse_repo_full_name(url: &str) -> Result<String, String> {
    // Handle various URL formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git

    let url = url.trim();

    if url.starts_with("https://github.com/") {
        let path = url.trim_start_matches("https://github.com/");
        let path = path.trim_end_matches(".git");
        return Ok(path.to_string());
    }

    if url.starts_with("git@github.com:") {
        let path = url.trim_start_matches("git@github.com:");
        let path = path.trim_end_matches(".git");
        return Ok(path.to_string());
    }

    Err(format!("Could not parse repository URL: {}", url))
}

/// Pull request information returned from GitHub API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestInfo {
    pub number: u32,
    pub title: String,
    pub state: String,           // "open" | "closed"
    pub merged: bool,
    pub mergeable: Option<bool>,
    pub mergeable_state: String, // "clean" | "dirty" | "blocked" | "behind" | "unstable"
    pub html_url: String,
}

/// Result of merging a pull request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeResult {
    pub merged: bool,
    pub message: String,
    pub sha: Option<String>,
}

/// Get pull request details from GitHub API
#[tauri::command]
pub async fn git_get_pr(
    repo_full_name: String,
    pr_number: u32,
) -> Result<PullRequestInfo, String> {
    let token = get_access_token()
        .ok_or("Not authenticated with GitHub. Please sign in first.")?;

    let client = reqwest::Client::new();

    #[derive(Deserialize)]
    struct GitHubPR {
        number: u32,
        title: String,
        state: String,
        merged: bool,
        mergeable: Option<bool>,
        mergeable_state: Option<String>,
        html_url: String,
    }

    let response = client
        .get(format!("https://api.github.com/repos/{}/pulls/{}", repo_full_name, pr_number))
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "hatch-desktop")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch PR: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("GitHub API error: {}", error_text));
    }

    let pr: GitHubPR = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse PR response: {}", e))?;

    Ok(PullRequestInfo {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        merged: pr.merged,
        mergeable: pr.mergeable,
        mergeable_state: pr.mergeable_state.unwrap_or_else(|| "unknown".to_string()),
        html_url: pr.html_url,
    })
}

/// Merge a pull request using GitHub API
#[tauri::command]
pub async fn git_merge_pr(
    repo_full_name: String,
    pr_number: u32,
    merge_method: String,
) -> Result<MergeResult, String> {
    let token = get_access_token()
        .ok_or("Not authenticated with GitHub. Please sign in first.")?;

    let client = reqwest::Client::new();

    #[derive(Serialize)]
    struct MergeRequest {
        merge_method: String, // "merge" | "squash" | "rebase"
    }

    #[derive(Deserialize)]
    struct MergeResponse {
        merged: bool,
        message: String,
        sha: Option<String>,
    }

    let response = client
        .put(format!("https://api.github.com/repos/{}/pulls/{}/merge", repo_full_name, pr_number))
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "hatch-desktop")
        .header("Accept", "application/vnd.github.v3+json")
        .json(&MergeRequest {
            merge_method,
        })
        .send()
        .await
        .map_err(|e| format!("Failed to merge PR: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("GitHub API error: {}", error_text));
    }

    let merge_response: MergeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse merge response: {}", e))?;

    Ok(MergeResult {
        merged: merge_response.merged,
        message: merge_response.message,
        sha: merge_response.sha,
    })
}

// We need uuid for generating workspace IDs
mod uuid {
    pub struct Uuid;

    impl Uuid {
        pub fn new_v4() -> UuidResult {
            use std::time::{SystemTime, UNIX_EPOCH};
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let random: u64 = now as u64 ^ (std::process::id() as u64);
            UuidResult(format!("{:016x}", random))
        }
    }

    pub struct UuidResult(String);

    impl UuidResult {
        pub fn to_string(&self) -> String {
            self.0.clone()
        }
    }
}
