use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ClaudeCodeStatus {
    installed: bool,
    authenticated: bool,
    version: Option<String>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CommandResult {
    success: bool,
    stdout: String,
    stderr: String,
    code: Option<i32>,
}

/// Check if Claude Code is installed and authenticated
#[tauri::command]
fn check_claude_code() -> ClaudeCodeStatus {
    // Check if claude command exists
    let which_result = Command::new("which")
        .arg("claude")
        .output();

    match which_result {
        Ok(output) => {
            if !output.status.success() {
                return ClaudeCodeStatus {
                    installed: false,
                    authenticated: false,
                    version: None,
                    error: Some("Claude Code is not installed. Install it from https://claude.ai/download".to_string()),
                };
            }
        }
        Err(e) => {
            return ClaudeCodeStatus {
                installed: false,
                authenticated: false,
                version: None,
                error: Some(format!("Failed to check for Claude Code: {}", e)),
            };
        }
    }

    // Get version
    let version_result = Command::new("claude")
        .arg("--version")
        .output();

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
    let auth_result = Command::new("claude")
        .args(["--print", "--output-format", "json", "Say ok"])
        .output();

    match auth_result {
        Ok(output) => {
            if output.status.success() {
                ClaudeCodeStatus {
                    installed: true,
                    authenticated: true,
                    version,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
                if stderr.contains("auth") || stderr.contains("login") || stderr.contains("credential") {
                    ClaudeCodeStatus {
                        installed: true,
                        authenticated: false,
                        version,
                        error: Some("Claude Code is not authenticated. Run \"claude login\" in your terminal".to_string()),
                    }
                } else {
                    ClaudeCodeStatus {
                        installed: true,
                        authenticated: false,
                        version,
                        error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
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
            }
        }
    }
}

/// Run Claude Code with the given prompt
#[tauri::command]
fn run_claude_code(prompt: String) -> CommandResult {
    let result = Command::new("claude")
        .args(["--print", "--output-format", "stream-json", &prompt])
        .output();

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
        .invoke_handler(tauri::generate_handler![check_claude_code, run_claude_code])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
