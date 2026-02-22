use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;
use tokio::process::Command as AsyncCommand;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub id: i64,
    pub avatar_url: String,
    pub name: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAuthState {
    pub access_token: Option<String>,
    pub user: Option<GitHubUser>,
    pub is_authenticated: bool,
}

impl Default for GitHubAuthState {
    fn default() -> Self {
        Self {
            access_token: None,
            user: None,
            is_authenticated: false,
        }
    }
}

/// Find the gh CLI executable by checking common locations
async fn find_gh_path() -> Option<PathBuf> {
    // First try using 'which' with user's shell PATH
    if let Ok(output) = AsyncCommand::new("sh")
        .args(["-l", "-c", "which gh"])
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
        "/opt/homebrew/bin/gh".to_string(),
        "/usr/local/bin/gh".to_string(),
        format!("{}/.local/bin/gh", home),
        "/usr/bin/gh".to_string(),
    ];

    for path in common_paths {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Some(p);
        }
    }

    // Last resort: try PATH directly
    if let Ok(output) = AsyncCommand::new("which").arg("gh").output().await {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }

    None
}

/// Check if the gh CLI is installed
#[tauri::command]
pub async fn github_check_gh_installed() -> Result<bool, String> {
    Ok(find_gh_path().await.is_some())
}

/// Get the current auth state by querying gh CLI
#[tauri::command]
pub async fn github_get_auth_state() -> Result<GitHubAuthState, String> {
    let gh_path = match find_gh_path().await {
        Some(path) => path,
        None => return Ok(GitHubAuthState::default()),
    };

    // Check auth status by fetching user info
    let output = AsyncCommand::new(&gh_path)
        .args(["api", "/user"])
        .output()
        .await
        .map_err(|e| format!("Failed to run gh api: {}", e))?;

    if !output.status.success() {
        // Not authenticated or gh not configured
        return Ok(GitHubAuthState::default());
    }

    let user: GitHubUser = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse user info: {}", e))?;

    // Get the token for API calls
    let token = get_access_token().await;

    Ok(GitHubAuthState {
        access_token: token,
        user: Some(user),
        is_authenticated: true,
    })
}

/// Log in via gh CLI (opens browser for OAuth)
#[tauri::command]
pub async fn github_login() -> Result<GitHubAuthState, String> {
    let gh_path = find_gh_path().await
        .ok_or("gh CLI is not installed. Install it from https://cli.github.com")?;

    // Run gh auth login --web -s repo
    let output = AsyncCommand::new(&gh_path)
        .args(["auth", "login", "--web", "-h", "github.com", "-s", "repo"])
        .output()
        .await
        .map_err(|e| format!("Failed to run gh auth login: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("GitHub login failed: {}", stderr));
    }

    // Fetch user info after successful login
    github_get_auth_state().await
}

/// Sign out from GitHub via gh CLI
#[tauri::command]
pub async fn github_sign_out() -> Result<(), String> {
    let gh_path = match find_gh_path().await {
        Some(path) => path,
        None => return Ok(()), // Nothing to sign out from
    };

    let output = AsyncCommand::new(&gh_path)
        .args(["auth", "logout", "--hostname", "github.com"])
        .stdin(std::process::Stdio::null())
        .output()
        .await
        .map_err(|e| format!("Failed to run gh auth logout: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Ignore "not logged in" errors
        if !stderr.contains("not logged in") {
            return Err(format!("Sign out failed: {}", stderr));
        }
    }

    Ok(())
}

/// Validate the current auth by fetching user info
#[tauri::command]
pub async fn github_validate_token() -> Result<GitHubUser, String> {
    let gh_path = find_gh_path().await
        .ok_or("gh CLI is not installed")?;

    let output = AsyncCommand::new(&gh_path)
        .args(["api", "/user"])
        .output()
        .await
        .map_err(|e| format!("Failed to validate token: {}", e))?;

    if !output.status.success() {
        return Err("Not authenticated".to_string());
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse user info: {}", e))
}

/// Get access token from gh CLI for API calls
pub async fn get_access_token() -> Option<String> {
    let gh_path = find_gh_path().await?;

    let output = AsyncCommand::new(&gh_path)
        .args(["auth", "token"])
        .output()
        .await
        .ok()?;

    if output.status.success() {
        let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !token.is_empty() {
            return Some(token);
        }
    }

    None
}
