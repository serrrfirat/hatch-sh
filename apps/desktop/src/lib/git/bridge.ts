import { invoke } from '@tauri-apps/api/core'
import type { GitCoordinatorQueueStatus, GitOperationPriority } from './coordinator/types'

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

export interface WorktreeInfo {
  path: string
  head: string
  branch: string | null
  is_bare: boolean
  is_detached: boolean
  is_locked: boolean
  is_prunable: boolean
}

export interface PullRequestInfo {
  number: number
  title: string
  state: 'open' | 'closed'
  merged: boolean
  mergeable: boolean | null
  mergeable_state: string
  html_url: string
}

export interface MergeResult {
  merged: boolean
  message: string
  sha?: string
}

interface GitCoordinatorRequest {
  repoRoot: string
  command: string
  params: Record<string, unknown>
  priority: GitOperationPriority
  type: string
}

function commandPriority(command: string): GitOperationPriority {
  switch (command) {
    case 'git_commit':
    case 'git_push':
    case 'git_delete_workspace_branch':
    case 'git_merge_pr':
      return 'critical'
    case 'git_diff':
    case 'git_diff_stats':
    case 'git_file_diff':
      return 'low'
    default:
      return 'normal'
  }
}

async function runCoordinatedGitCommand<T>(
  repoRoot: string,
  command: string,
  params: Record<string, unknown>,
  type: string
): Promise<T> {
  const request: GitCoordinatorRequest = {
    repoRoot,
    command,
    params,
    priority: commandPriority(command),
    type,
  }

  return invoke<T>('git_coordinator_enqueue', { request })
}

export async function getGitCoordinatorStatus(
  repoRoot: string
): Promise<GitCoordinatorQueueStatus> {
  return invoke<GitCoordinatorQueueStatus>('git_coordinator_status', { request: { repoRoot } })
}

export async function cancelGitCoordinatorOperation(operationId: string): Promise<boolean> {
  return invoke<boolean>('git_coordinator_cancel', { request: { operationId } })
}

/**
 * Clone a repository from GitHub
 */
export async function cloneRepo(repoUrl: string, repoName: string): Promise<Repository> {
  return runCoordinatedGitCommand<Repository>(
    `clone:${repoName}`,
    'git_clone_repo',
    { repoUrl, repoName },
    'clone'
  )
}

/**
 * Open an existing local repository
 */
export async function openLocalRepo(path: string): Promise<Repository> {
  return runCoordinatedGitCommand<Repository>(path, 'git_open_local_repo', { path }, 'open-local')
}

/**
 * Create a new workspace with its own worktree for isolation
 */
export async function createWorkspaceBranch(
  repoPath: string,
  workspaceId: string
): Promise<WorkspaceResult> {
  return runCoordinatedGitCommand<WorkspaceResult>(
    repoPath,
    'git_create_workspace_branch',
    { repoPath, workspaceId },
    'worktree-create'
  )
}

/**
 * Delete a workspace branch and its worktree
 */
export async function deleteWorkspaceBranch(
  repoPath: string,
  branchName: string,
  worktreePath?: string
): Promise<void> {
  await runCoordinatedGitCommand<null>(
    repoPath,
    'git_delete_workspace_branch',
    { repoPath, branchName, worktreePath },
    'worktree-delete'
  )
}

/**
 * List all worktrees for a repository
 */
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  return runCoordinatedGitCommand<WorktreeInfo[]>(
    repoPath,
    'git_list_worktrees',
    { repoPath },
    'worktree-list'
  )
}

/**
 * Prune stale worktree references
 */
export async function pruneWorktrees(repoPath: string): Promise<string> {
  return runCoordinatedGitCommand<string>(
    repoPath,
    'git_prune_worktrees',
    { repoPath },
    'worktree-prune'
  )
}

/**
 * Get git status for a repository
 */
export async function getGitStatus(repoPath: string): Promise<GitStatus> {
  return runCoordinatedGitCommand<GitStatus>(repoPath, 'git_status', { repoPath }, 'status')
}

/**
 * Commit all changes with the given message
 */
export async function commitChanges(repoPath: string, message: string): Promise<string> {
  return runCoordinatedGitCommand<string>(repoPath, 'git_commit', { repoPath, message }, 'commit')
}

/**
 * Push changes to remote
 */
export async function pushChanges(repoPath: string, branch: string): Promise<void> {
  await runCoordinatedGitCommand<null>(repoPath, 'git_push', { repoPath, branch }, 'push')
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
  return runCoordinatedGitCommand<string>(
    `github:${repoFullName}`,
    'git_create_pr',
    { repoFullName, headBranch, baseBranch, title, body },
    'create-pr'
  )
}

/**
 * Create a new GitHub repository
 */
export async function createGitHubRepo(name: string, isPrivate: boolean): Promise<Repository> {
  return runCoordinatedGitCommand<Repository>(
    `github:create:${name}`,
    'git_create_github_repo',
    { name, isPrivate },
    'create-repo'
  )
}

/**
 * Get the diff for a repository
 */
export async function getDiff(repoPath: string): Promise<string> {
  return runCoordinatedGitCommand<string>(repoPath, 'git_diff', { repoPath }, 'diff')
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
  return runCoordinatedGitCommand<FileChange[]>(
    repoPath,
    'git_diff_stats',
    { repoPath },
    'diff-stats'
  )
}

/**
 * List all files in a directory recursively
 */
export async function listDirectoryFiles(
  dirPath: string,
  maxDepth?: number,
  showHidden?: boolean
): Promise<FileEntry[]> {
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
  return runCoordinatedGitCommand<FileDiff>(
    repoPath,
    'git_file_diff',
    { repoPath, filePath },
    'file-diff'
  )
}

/**
 * Get pull request details from GitHub
 */
export async function getPullRequest(
  repoFullName: string,
  prNumber: number
): Promise<PullRequestInfo> {
  return runCoordinatedGitCommand<PullRequestInfo>(
    `github:${repoFullName}`,
    'git_get_pr',
    { repoFullName, prNumber },
    'get-pr'
  )
}

/**
 * Merge a pull request
 */
export async function mergePullRequest(
  repoFullName: string,
  prNumber: number,
  mergeMethod: string = 'squash'
): Promise<MergeResult> {
  return runCoordinatedGitCommand<MergeResult>(
    `github:${repoFullName}`,
    'git_merge_pr',
    { repoFullName, prNumber, mergeMethod },
    'merge-pr'
  )
}
