import { invoke } from '@tauri-apps/api/core'

export interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  name?: string
  email?: string
}

export interface GitHubAuthState {
  access_token?: string
  user?: GitHubUser
  is_authenticated: boolean
}

export interface DeviceFlowInit {
  user_code: string
  verification_uri: string
  expires_in: number
}

/**
 * Start the GitHub device flow authentication
 * Opens the browser for user to authorize
 * Returns the user code to display
 */
export async function startDeviceFlow(): Promise<DeviceFlowInit> {
  return invoke<DeviceFlowInit>('github_start_device_flow')
}

/**
 * Poll for the access token after user authorizes
 * This will keep polling until the user completes authorization or timeout
 */
export async function pollForToken(userCode: string): Promise<GitHubAuthState> {
  return invoke<GitHubAuthState>('github_poll_for_token', { userCode })
}

/**
 * Get the current auth state
 */
export async function getAuthState(): Promise<GitHubAuthState> {
  return invoke<GitHubAuthState>('github_get_auth_state')
}

/**
 * Sign out from GitHub
 */
export async function signOut(): Promise<void> {
  return invoke('github_sign_out')
}
