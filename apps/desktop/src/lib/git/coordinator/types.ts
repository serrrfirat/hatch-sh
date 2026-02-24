/**
 * Git Coordinator System - Core Types
 *
 * Defines the interfaces for:
 * - Git operation queueing and coordination
 * - Worktree lifecycle management
 * - Agent process management
 *
 * The coordinator ensures serialized git operations per repository root
 * with proper concurrency control and error handling.
 */

// ============================================================================
// Git Operation Queue Types
// ============================================================================

/** Priority levels for git operations */
export type GitOperationPriority = 'critical' | 'normal' | 'low'

/** Status of a git operation in the queue */
export type GitOperationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'

/** A single git operation in the queue */
export interface GitOperation {
  /** Unique identifier for this operation */
  id: string

  /** Type of git operation (e.g., 'commit', 'push', 'pull', 'status', 'worktree-create') */
  type: string

  /** Absolute path to repository root (queue is per-repoRoot) */
  repoRoot: string

  /** Path to specific worktree if applicable */
  worktreePath?: string

  /** Git command name (e.g., 'commit', 'push', 'pull') */
  command: string

  /** Git command arguments */
  args: string[]

  /** Priority level for operation execution */
  priority: GitOperationPriority

  /** Current status of the operation */
  status: GitOperationStatus

  /** Timestamp when operation was enqueued (Date.now()) */
  enqueuedAt: number

  /** Timestamp when operation started executing */
  startedAt?: number

  /** Timestamp when operation completed */
  completedAt?: number

  /** Error message if operation failed */
  error?: string
}

/** Coordinator queue status for a repository */
export interface GitCoordinatorQueueStatus {
  /** Repository root path */
  repoRoot: string

  /** Number of pending operations */
  pendingCount: number

  /** Currently running operation, or null if idle */
  runningOperation: GitOperation | null

  /** Number of completed operations */
  completedCount: number

  /** Number of failed operations */
  failedCount: number
}

/** Main git coordinator interface */
export interface GitCoordinator {
  /**
   * Enqueue a git operation for execution
   *
   * @param operation - Operation details (id, status, enqueuedAt will be auto-generated)
   * @returns Promise resolving to the operation ID
   */
  enqueue(operation: Omit<GitOperation, 'id' | 'status' | 'enqueuedAt'>): Promise<string>

  /**
   * Get the current queue status for a repository
   *
   * @param repoRoot - Absolute path to repository root
   * @returns Promise resolving to queue status
   */
  getQueueStatus(repoRoot: string): Promise<GitCoordinatorQueueStatus>

  /**
   * Cancel a specific operation by ID
   *
   * @param operationId - ID of operation to cancel
   * @returns Promise resolving to true if cancelled, false if not found
   */
  cancelOperation(operationId: string): Promise<boolean>

  /**
   * Cancel all pending operations for a repository
   *
   * @param repoRoot - Absolute path to repository root
   * @returns Promise that resolves when all operations are cancelled
   */
  cancelAll(repoRoot: string): Promise<void>

  /**
   * Wait for all pending operations to complete
   *
   * @param repoRoot - Absolute path to repository root
   * @returns Promise that resolves when queue is empty
   */
  flush(repoRoot: string): Promise<void>
}

// ============================================================================
// Worktree Lifecycle Types
// ============================================================================

/** Health status of a worktree */
export type WorktreeHealthStatus = 'healthy' | 'orphaned' | 'locked' | 'corrupted'

/** Information about a worktree */
export interface WorktreeInfo {
  /** Absolute path to worktree */
  path: string

  /** Current branch name */
  branch: string

  /** Current HEAD commit SHA */
  headCommit: string

  /** Whether worktree is locked */
  isLocked: boolean

  /** Reason for lock if locked */
  lockReason?: string

  /** Health status of worktree */
  healthStatus: WorktreeHealthStatus
}

/** Worktree lifecycle manager interface */
export interface WorktreeLifecycleManager {
  /**
   * Create a new worktree for a branch
   *
   * @param repoRoot - Absolute path to repository root
   * @param branch - Branch name to check out in worktree
   * @param worktreePath - Absolute path where worktree should be created
   * @returns Promise resolving to worktree info
   */
  create(repoRoot: string, branch: string, worktreePath: string): Promise<WorktreeInfo>

  /**
   * Lock a worktree to prevent accidental removal
   *
   * @param worktreePath - Absolute path to worktree
   * @param reason - Reason for locking
   * @returns Promise that resolves when locked
   */
  lock(worktreePath: string, reason: string): Promise<void>

  /**
   * Unlock a worktree
   *
   * @param worktreePath - Absolute path to worktree
   * @returns Promise that resolves when unlocked
   */
  unlock(worktreePath: string): Promise<void>

  /**
   * Remove a worktree
   *
   * @param worktreePath - Absolute path to worktree
   * @returns Promise that resolves when removed
   */
  remove(worktreePath: string): Promise<void>

  /**
   * Repair corrupted worktrees in a repository
   *
   * @param repoRoot - Absolute path to repository root
   * @returns Promise that resolves when repair is complete
   */
  repair(repoRoot: string): Promise<void>

  /**
   * Prune stale worktree references
   *
   * @param repoRoot - Absolute path to repository root
   * @returns Promise that resolves when pruning is complete
   */
  prune(repoRoot: string): Promise<void>

  /**
   * List all worktrees in a repository
   *
   * @param repoRoot - Absolute path to repository root
   * @returns Promise resolving to array of worktree info
   */
  list(repoRoot: string): Promise<WorktreeInfo[]>

  /**
   * Get health status of a worktree
   *
   * @param worktreePath - Absolute path to worktree
   * @returns Promise resolving to health status
   */
  getHealth(worktreePath: string): Promise<WorktreeHealthStatus>
}

// ============================================================================
// Agent Process Management Types
// ============================================================================

/** Status of an agent process */
export type AgentProcessStatus = 'starting' | 'streaming' | 'idle' | 'error' | 'killed'

/** An agent process tied to a workspace */
export interface AgentProcess {
  /** Unique identifier for this process */
  id: string

  /** ID of the workspace this process is associated with */
  workspaceId: string

  /** Path to the worktree this process operates on */
  worktreePath: string

  /** Type of agent running */
  agentType: 'claude-code' | 'opencode' | 'cursor' | 'codex'

  /** Operating system process ID (if available) */
  pid?: number

  /** Current status of the process */
  status: AgentProcessStatus

  /** Timestamp when process was started (Date.now()) */
  startedAt: number

  /** Timestamp of last activity */
  lastActivityAt?: number

  /** Estimated RAM usage in MB */
  estimatedRamMb?: number
}

/** Agent process manager interface */
export interface AgentProcessManager {
  /**
   * Spawn a new agent process for a workspace
   *
   * @param workspaceId - ID of the workspace
   * @param worktreePath - Path to the worktree
   * @param agentType - Type of agent to spawn
   * @returns Promise resolving to the spawned process info
   */
  spawn(
    workspaceId: string,
    worktreePath: string,
    agentType: AgentProcess['agentType']
  ): Promise<AgentProcess>

  /**
   * Kill an agent process
   *
   * @param processId - ID of the process to kill
   * @returns Promise that resolves when process is killed
   */
  kill(processId: string): Promise<void>

  /**
   * List all active agent processes
   *
   * @returns Array of active processes
   */
  list(): AgentProcess[]

  /**
   * Get the status of a specific process
   *
   * @param processId - ID of the process
   * @returns Status of the process, or null if not found
   */
  getStatus(processId: string): AgentProcessStatus | null

  /**
   * Get the maximum number of concurrent processes allowed
   *
   * @returns Maximum concurrent process count
   */
  getMaxConcurrent(): number

  /**
   * Check if more processes can be spawned
   *
   * @returns true if under max capacity, false otherwise
   */
  canSpawnMore(): boolean
}
