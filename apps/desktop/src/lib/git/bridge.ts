import { invoke } from '@tauri-apps/api/core'

export interface Repository {
  id: string
  name: string
  full_name: string // owner/repo
  clone_url: string
  local_path: string
  default_branch: string
  is_private: boolean
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
}

export interface FileChange {
  path: string
  additions: number
  deletions: number
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
}

export interface FileEntry {
  name: string
  path: string
  is_directory: boolean
  children?: FileEntry[]
}

export interface FileContent {
  path: string
  content: string
  language: string
  size: number
}

export interface FileDiff {
  path: string
  old_content: string
  new_content: string
  language: string
  is_new_file: boolean
  is_deleted: boolean
}

export interface WorkspaceResult {
  branch_name: string
  worktree_path: string
}

/**
 * Clone a repository from GitHub
 */
export async function cloneRepo(repoUrl: string, repoName: string): Promise<Repository> {
  return invoke<Repository>('git_clone_repo', { repoUrl, repoName })
}

/**
 * Open an existing local repository
 */
export async function openLocalRepo(path: string): Promise<Repository> {
  return invoke<Repository>('git_open_local_repo', { path })
}

/**
 * Create a new workspace with its own worktree for isolation
 */
export async function createWorkspaceBranch(repoPath: string, workspaceId: string): Promise<WorkspaceResult> {
  return invoke<WorkspaceResult>('git_create_workspace_branch', { repoPath, workspaceId })
}

/**
 * Delete a workspace branch and its worktree
 */
export async function deleteWorkspaceBranch(repoPath: string, branchName: string, worktreePath?: string): Promise<void> {
  return invoke('git_delete_workspace_branch', { repoPath, branchName, worktreePath })
}

/**
 * Get git status for a repository
 */
export async function getGitStatus(repoPath: string): Promise<GitStatus> {
  return invoke<GitStatus>('git_status', { repoPath })
}

/**
 * Commit all changes with the given message
 */
export async function commitChanges(repoPath: string, message: string): Promise<string> {
  return invoke<string>('git_commit', { repoPath, message })
}

/**
 * Push changes to remote
 */
export async function pushChanges(repoPath: string, branch: string): Promise<void> {
  return invoke('git_push', { repoPath, branch })
}

/**
 * Create a pull request using GitHub API
 */
export async function createPR(
  repoFullName: string,
  headBranch: string,
  baseBranch: string,
  title: string,
  body: string
): Promise<string> {
  return invoke<string>('git_create_pr', {
    repoFullName,
    headBranch,
    baseBranch,
    title,
    body,
  })
}

/**
 * Create a new GitHub repository
 */
export async function createGitHubRepo(name: string, isPrivate: boolean): Promise<Repository> {
  return invoke<Repository>('git_create_github_repo', { name, isPrivate })
}

/**
 * Get the diff for a repository
 */
export async function getDiff(repoPath: string): Promise<string> {
  return invoke<string>('git_diff', { repoPath })
}

/**
 * Extract repo name from GitHub URL
 */
export function extractRepoName(url: string): string {
  // Handle various URL formats
  const cleanUrl = url.trim().replace(/\.git$/, '')

  // https://github.com/owner/repo
  if (cleanUrl.includes('github.com/')) {
    const parts = cleanUrl.split('github.com/')[1]?.split('/') || []
    return parts[parts.length - 1] || 'repo'
  }

  // git@github.com:owner/repo
  if (cleanUrl.includes(':')) {
    const parts = cleanUrl.split(':')[1]?.split('/') || []
    return parts[parts.length - 1] || 'repo'
  }

  return 'repo'
}

/**
 * Get detailed diff stats for each changed file
 */
export async function getDiffStats(repoPath: string): Promise<FileChange[]> {
  return invoke<FileChange[]>('git_diff_stats', { repoPath })
}

/**
 * List all files in a directory recursively
 */
export async function listDirectoryFiles(dirPath: string, maxDepth?: number, showHidden?: boolean): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('list_directory_files', { dirPath, maxDepth, showHidden })
}

/**
 * Read the contents of a file
 */
export async function readFile(filePath: string): Promise<FileContent> {
  return invoke<FileContent>('read_file', { filePath })
}

/**
 * Get diff for a specific file (old content vs new content)
 */
export async function getFileDiff(repoPath: string, filePath: string): Promise<FileDiff> {
  return invoke<FileDiff>('git_file_diff', { repoPath, filePath })
}
