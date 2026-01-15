use std::env;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tokio::process::Command as AsyncCommand;

mod github;
mod git;

use github::{github_start_device_flow, github_poll_for_token, github_get_auth_state, github_sign_out};
use git::{
    git_clone_repo, git_open_local_repo, git_create_workspace_branch, git_delete_workspace_branch,
    git_status, git_commit, git_push, git_create_pr, git_create_github_repo, git_diff,
    git_diff_stats, list_directory_files, read_file, git_file_diff
};

#[derive(Serialize, Deserialize)]
pub struct ClaudeCodeStatus {
    installed: bool,
    authenticated: bool,
    version: Option<String>,
    error: Option<String>,
    path: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CommandResult {
    success: bool,
    stdout: String,
    stderr: String,
    code: Option<i32>,
}

/// Find the claude executable by checking common locations (async version)
async fn find_claude_path_async() -> Option<PathBuf> {
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

/// Check if Claude Code is installed and authenticated (async to avoid blocking UI)
#[tauri::command]
async fn check_claude_code() -> ClaudeCodeStatus {
    // Find claude executable
    let claude_path = match find_claude_path_async().await {
        Some(path) => path,
        None => {
            return ClaudeCodeStatus {
                installed: false,
                authenticated: false,
                version: None,
                error: Some("Claude Code is not installed. Install it from https://claude.ai/download".to_string()),
                path: None,
            };
        }
    };

    let path_str = claude_path.to_string_lossy().to_string();

    // Get version (async)
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

    // Check authentication by running a simple command (async)
    let auth_result = AsyncCommand::new(&claude_path)
        .args(["--print", "--output-format", "json", "Say ok"])
        .output()
        .await;

    match auth_result {
        Ok(output) => {
            if output.status.success() {
                ClaudeCodeStatus {
                    installed: true,
                    authenticated: true,
                    version,
                    error: None,
                    path: Some(path_str),
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
                if stderr.contains("auth") || stderr.contains("login") || stderr.contains("credential") {
                    ClaudeCodeStatus {
                        installed: true,
                        authenticated: false,
                        version,
                        error: Some("Claude Code is not authenticated. Run \"claude login\" in your terminal".to_string()),
                        path: Some(path_str),
                    }
                } else {
                    ClaudeCodeStatus {
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
            ClaudeCodeStatus {
                installed: true,
                authenticated: false,
                version,
                error: Some(format!("Failed to check authentication: {}", e)),
                path: Some(path_str),
            }
        }
    }
}

/// Run Claude Code with the given prompt (async to avoid blocking UI)
#[tauri::command]
async fn run_claude_code(prompt: String) -> CommandResult {
    let claude_path = match find_claude_path_async().await {
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

    // Use --print with --output-format text for simpler parsing
    // stream-json requires --verbose which adds too much noise
    // Using AsyncCommand to avoid blocking the main thread
    let result = AsyncCommand::new(&claude_path)
        .args(["--print", &prompt])
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Claude Code commands
            check_claude_code,
            run_claude_code,
            // GitHub auth commands
            github_start_device_flow,
            github_poll_for_token,
            github_get_auth_state,
            github_sign_out,
            // Git commands
            git_clone_repo,
            git_open_local_repo,
            git_create_workspace_branch,
            git_delete_workspace_branch,
            git_status,
            git_commit,
            git_push,
            git_create_pr,
            git_create_github_repo,
            git_diff,
            git_diff_stats,
            list_directory_files,
            read_file,
            git_file_diff
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
