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

/**
 * Check if the gh CLI is installed on the system
 */
export async function checkGhInstalled(): Promise<boolean> {
  return invoke<boolean>('github_check_gh_installed')
}

/**
 * Log in via gh CLI (opens browser for OAuth)
 * Single call that replaces the old start+poll device flow
 */
export async function login(): Promise<GitHubAuthState> {
  return invoke<GitHubAuthState>('github_login')
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

/**
 * Validate the stored token by checking against GitHub API
 */
export async function validateToken(): Promise<GitHubUser> {
  return invoke<GitHubUser>('github_validate_token')
}


/**
 * Detect if an error indicates an expired or invalid GitHub auth token.
 * Checks for common patterns from gh CLI, git, and GitHub API responses.
 */
export function isAuthExpiredError(error: unknown): boolean {
  if (error == null) return false

  const message = error instanceof Error ? error.message : String(error)
  if (!message) return false

  const lower = message.toLowerCase()
  return (
    lower.includes('401') ||
    lower.includes('bad credentials') ||
    lower.includes('token expired') || lower.includes('token has expired') ||
    lower.includes('authentication failed') ||
    lower.includes('not authenticated')
  )
}