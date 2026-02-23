import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockZustandPersist, createGitBridgeMock, createGitHubBridgeMock } from '../helpers'
import {
  createDefaultRepositoryState,
  createDefaultChatState,
  createTestRepository,
} from '../helpers'

vi.mock('zustand/middleware', async () => mockZustandPersist())
vi.mock('../../src/lib/git/bridge', () => createGitBridgeMock())
vi.mock('../../src/lib/github/bridge', () => createGitHubBridgeMock())

import { useRepositoryStore } from '../../src/stores/repositoryStore'
import { useChatStore } from '../../src/stores/chatStore'
import * as gitBridge from '../../src/lib/git/bridge'

describe('shipping workspace -> PR flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepositoryStore.setState(
      createDefaultRepositoryState({
        repositories: [createTestRepository({ id: 'repo-1' })],
      })
    )
    useChatStore.setState(createDefaultChatState())
  })

  it('creates workspace, commits, pushes, creates and merges PR', async () => {
    vi.mocked(gitBridge.worktreeCreate).mockResolvedValue({
      branch_name: 'ws-1',
      worktree_path: '/tmp/hatch-sh/.worktrees/ws-1',
    })
    vi.mocked(gitBridge.getGitStatus).mockResolvedValue({
      branch: 'ws-1',
      ahead: 0,
      behind: 0,
      staged: ['a.ts'],
      modified: ['b.ts'],
      untracked: ['c.ts'],
    })
    vi.mocked(gitBridge.commitChanges).mockResolvedValue('abc123')
    vi.mocked(gitBridge.pushChanges).mockResolvedValue()
    vi.mocked(gitBridge.createPR).mockResolvedValue(
      'https://github.com/serrrfirat/hatch-sh/pull/42'
    )
    vi.mocked(gitBridge.mergePullRequest).mockResolvedValue({
      merged: true,
      message: 'merged',
      sha: 'def456',
    })

    const store = useRepositoryStore.getState()
    const workspace = await store.createWorkspace('repo-1')

    expect(workspace.localPath).toContain('.worktrees')

    const status = await useRepositoryStore.getState().getGitStatus(workspace.id)
    expect(status.modified).toContain('b.ts')

    const commitHash = await useRepositoryStore
      .getState()
      .commitChanges(workspace.id, 'feat: update')
    expect(commitHash).toBe('abc123')

    await useRepositoryStore.getState().pushChanges(workspace.id)

    const prUrl = await useRepositoryStore
      .getState()
      .createPullRequest(workspace.id, 'Test PR', 'Body')
    expect(prUrl).toContain('/pull/42')

    await useRepositoryStore.getState().mergePullRequest(workspace.id)

    const finalWorkspace = useRepositoryStore
      .getState()
      .workspaces.find((w) => w.id === workspace.id)

    expect(finalWorkspace?.prState).toBe('merged')
    expect(finalWorkspace?.prNumber).toBe(42)
  })

  it('removeWorkspace cleans up associated chat state', async () => {
    vi.mocked(gitBridge.worktreeCreate).mockResolvedValue({
      branch_name: 'ws-cleanup',
      worktree_path: '/tmp/hatch-sh/.worktrees/ws-cleanup',
    })
    vi.mocked(gitBridge.worktreeRemove).mockResolvedValue()

    const workspace = await useRepositoryStore.getState().createWorkspace('repo-1')
    useRepositoryStore.getState().setCurrentWorkspace(workspace)

    expect(useChatStore.getState().currentWorkspaceId).toBe(workspace.id)

    await useRepositoryStore.getState().removeWorkspace(workspace.id)

    expect(useRepositoryStore.getState().currentWorkspace).toBeNull()
    expect(useChatStore.getState().currentWorkspaceId).toBeNull()
  })

  it('workspace initializes with correct agent selection', async () => {
    vi.mocked(gitBridge.worktreeCreate).mockResolvedValue({
      branch_name: 'ws-agent',
      worktree_path: '/tmp/hatch-sh/.worktrees/ws-agent',
    })

    const workspace = await useRepositoryStore.getState().createWorkspace('repo-1')

    // Default agent should be set
    expect(workspace.agentId).toBeDefined()
    expect(workspace.isInitializing).toBe(false)
  })
})
