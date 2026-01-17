use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use tokio::time::sleep;

// GitHub OAuth App credentials - these should be configured for your app
// For development, you'll need to create a GitHub OAuth App
const GITHUB_CLIENT_ID: &str = "Ov23liYourClientIdHere"; // TODO: Replace with actual client ID

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

// Global auth state (in production, consider using tauri's state management)
lazy_static::lazy_static! {
    static ref AUTH_STATE: Mutex<GitHubAuthState> = Mutex::new(GitHubAuthState::default());
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Serialize)]
pub struct DeviceFlowInit {
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

/// Start the GitHub device flow authentication
#[tauri::command]
pub async fn github_start_device_flow() -> Result<DeviceFlowInit, String> {
    let client = reqwest::Client::new();

    let response = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("scope", "repo"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to start device flow: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    let device_response: DeviceCodeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Store the device code for polling
    {
        let mut state = AUTH_STATE.lock().map_err(|e| format!("Lock error: {}", e))?;
        *state = GitHubAuthState::default();
    }

    // Open the verification URL in the browser
    let _ = open::that(&device_response.verification_uri);

    Ok(DeviceFlowInit {
        user_code: device_response.user_code,
        verification_uri: device_response.verification_uri,
        expires_in: device_response.expires_in,
    })
}

/// Poll for the access token after user authorizes
#[tauri::command]
pub async fn github_poll_for_token(user_code: String) -> Result<GitHubAuthState, String> {
    let client = reqwest::Client::new();

    // Get device code by starting a new flow (in production, cache this)
    let device_response = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("scope", "repo"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to get device code: {}", e))?
        .json::<DeviceCodeResponse>()
        .await
        .map_err(|e| format!("Failed to parse device code: {}", e))?;

    let interval = Duration::from_secs(device_response.interval.max(5));
    let max_attempts = device_response.expires_in / device_response.interval;

    for _ in 0..max_attempts {
        sleep(interval).await;

        let token_response = client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .form(&[
                ("client_id", GITHUB_CLIENT_ID),
                ("device_code", &device_response.device_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .map_err(|e| format!("Failed to poll for token: {}", e))?;

        let token_data: AccessTokenResponse = token_response
            .json()
            .await
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        if let Some(access_token) = token_data.access_token {
            // Got the token! Now fetch user info
            let user = fetch_github_user(&client, &access_token).await?;

            let auth_state = GitHubAuthState {
                access_token: Some(access_token.clone()),
                user: Some(user),
                is_authenticated: true,
            };

            // Store in global state
            {
                let mut state = AUTH_STATE.lock().map_err(|e| format!("Lock error: {}", e))?;
                *state = auth_state.clone();
            }

            // Also save to disk for persistence
            save_auth_to_disk(&auth_state)?;

            return Ok(auth_state);
        }

        if let Some(error) = token_data.error {
            match error.as_str() {
                "authorization_pending" => continue,
                "slow_down" => {
                    sleep(Duration::from_secs(5)).await;
                    continue;
                }
                "expired_token" => return Err("Authorization expired. Please try again.".to_string()),
                "access_denied" => return Err("Access denied by user.".to_string()),
                _ => return Err(format!("GitHub error: {}", token_data.error_description.unwrap_or(error))),
            }
        }
    }

    Err("Authorization timed out".to_string())
}

async fn fetch_github_user(client: &reqwest::Client, token: &str) -> Result<GitHubUser, String> {
    let response = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "hatch-desktop")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch user: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse user: {}", e))
}

/// Get the current auth state
#[tauri::command]
pub fn github_get_auth_state() -> Result<GitHubAuthState, String> {
    // First try to load from disk
    if let Ok(state) = load_auth_from_disk() {
        if state.is_authenticated {
            // Update global state
            let mut global = AUTH_STATE.lock().map_err(|e| format!("Lock error: {}", e))?;
            *global = state.clone();
            return Ok(state);
        }
    }

    // Fall back to in-memory state
    let state = AUTH_STATE.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(state.clone())
}

/// Sign out from GitHub
#[tauri::command]
pub fn github_sign_out() -> Result<(), String> {
    {
        let mut state = AUTH_STATE.lock().map_err(|e| format!("Lock error: {}", e))?;
        *state = GitHubAuthState::default();
    }

    // Remove saved auth
    if let Some(config_dir) = dirs::config_dir() {
        let auth_file = config_dir.join("hatch").join("github_auth.json");
        let _ = std::fs::remove_file(auth_file);
    }

    Ok(())
}

fn get_auth_file_path() -> Option<std::path::PathBuf> {
    dirs::config_dir().map(|d| d.join("hatch").join("github_auth.json"))
}

fn save_auth_to_disk(state: &GitHubAuthState) -> Result<(), String> {
    let path = get_auth_file_path().ok_or("Could not determine config directory")?;

    // Create directory if needed
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize auth state: {}", e))?;

    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write auth file: {}", e))?;

    Ok(())
}

fn load_auth_from_disk() -> Result<GitHubAuthState, String> {
    let path = get_auth_file_path().ok_or("Could not determine config directory")?;

    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read auth file: {}", e))?;

    serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse auth file: {}", e))
}

/// Get access token for API calls
pub fn get_access_token() -> Option<String> {
    if let Ok(state) = AUTH_STATE.lock() {
        return state.access_token.clone();
    }

    // Try loading from disk
    if let Ok(state) = load_auth_from_disk() {
        return state.access_token;
    }

    None
}
