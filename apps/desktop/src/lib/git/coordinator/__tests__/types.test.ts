import { describe, it, expect } from 'vitest'
import type {
  GitCoordinator,
  GitOperation,
  GitCoordinatorQueueStatus,
  WorktreeLifecycleManager,
  WorktreeInfo,
  AgentProcess,
  AgentProcessManager,
} from '../types'

describe('GitCoordinator Types', () => {
  it('should compile GitCoordinator interface', () => {
    const mockCoordinator: GitCoordinator = {
      enqueue: async () => {
        return 'op-123'
      },
      getQueueStatus: async () => {
        const status: GitCoordinatorQueueStatus = {
          repoRoot: '/path/to/repo',
          pendingCount: 0,
          runningOperation: null,
          completedCount: 0,
          failedCount: 0,
        }
        return status
      },
      cancelOperation: async () => {
        return true
      },
      cancelAll: async () => {
        // noop
      },
      flush: async () => {
        // noop
      },
    }

    expect(mockCoordinator).toBeDefined()
    expect(typeof mockCoordinator.enqueue).toBe('function')
    expect(typeof mockCoordinator.getQueueStatus).toBe('function')
    expect(typeof mockCoordinator.cancelOperation).toBe('function')
    expect(typeof mockCoordinator.cancelAll).toBe('function')
    expect(typeof mockCoordinator.flush).toBe('function')
  })

  it('should compile GitOperation interface', () => {
    const operation: GitOperation = {
      id: 'op-123',
      type: 'commit',
      repoRoot: '/path/to/repo',
      command: 'commit',
      args: ['-m', 'test commit'],
      priority: 'normal',
      status: 'pending',
      enqueuedAt: Date.now(),
    }

    expect(operation.id).toBe('op-123')
    expect(operation.type).toBe('commit')
    expect(operation.status).toBe('pending')
  })

  it('should compile WorktreeLifecycleManager interface', () => {
    const mockManager: WorktreeLifecycleManager = {
      create: async (_, __, worktreePath) => {
        const info: WorktreeInfo = {
          path: worktreePath,
          branch: 'main',
          headCommit: 'abc123',
          isLocked: false,
          healthStatus: 'healthy',
        }
        return info
      },
      lock: async () => {
        // noop
      },
      unlock: async () => {
        // noop
      },
      remove: async () => {
        // noop
      },
      repair: async () => {
        // noop
      },
      prune: async () => {
        // noop
      },
      list: async () => {
        return []
      },
      getHealth: async () => {
        return 'healthy'
      },
    }

    expect(mockManager).toBeDefined()
    expect(typeof mockManager.create).toBe('function')
    expect(typeof mockManager.list).toBe('function')
  })

  it('should compile AgentProcess interface', () => {
    const process: AgentProcess = {
      id: 'proc-123',
      workspaceId: 'ws-123',
      worktreePath: '/path/to/worktree',
      agentType: 'claude-code',
      status: 'idle',
      startedAt: Date.now(),
    }

    expect(process.id).toBe('proc-123')
    expect(process.agentType).toBe('claude-code')
    expect(process.status).toBe('idle')
  })

  it('should compile AgentProcessManager interface', () => {
    const mockManager: AgentProcessManager = {
      spawn: async (workspaceId, worktreePath, agentType) => {
        const proc: AgentProcess = {
          id: 'proc-123',
          workspaceId,
          worktreePath,
          agentType,
          status: 'starting',
          startedAt: Date.now(),
        }
        return proc
      },
      kill: async () => {
        // noop
      },
      list: () => {
        return []
      },
      getStatus: () => {
        return 'idle'
      },
      getMaxConcurrent: () => {
        return 4
      },
      canSpawnMore: () => {
        return true
      },
    }

    expect(mockManager).toBeDefined()
    expect(typeof mockManager.spawn).toBe('function')
    expect(mockManager.getMaxConcurrent()).toBe(4)
    expect(mockManager.canSpawnMore()).toBe(true)
  })
})
