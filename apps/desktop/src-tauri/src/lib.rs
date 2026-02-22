use std::env;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tokio::process::Command as AsyncCommand;
use tokio::io::{BufReader, AsyncBufReadExt};
use std::process::Stdio;
use tauri::{Emitter, Manager};

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
    let mut reader = BufReader::new(stdout).lines();
    let mut full_output = String::new();

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

    // Emit completion event
    let _ = app.emit("claude-stream", StreamEvent {
        event_type: "done".to_string(),
        data: String::new(),
        session_id: session_id.clone(),
    });

    CommandResult {
        success,
        stdout: full_output,
        stderr: String::new(),
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
// Application Entry Point
// =============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            // Webview navigation
            webview_navigate
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
