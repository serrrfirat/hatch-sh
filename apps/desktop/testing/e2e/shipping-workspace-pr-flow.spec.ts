import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware')
  return {
    ...actual,
    persist: ((stateCreator: unknown) => stateCreator) as typeof actual.persist,
  }
})

vi.mock('../../src/lib/git/bridge', () => ({
  createWorkspaceBranch: vi.fn(),
  deleteWorkspaceBranch: vi.fn(),
  getGitStatus: vi.fn(),
  commitChanges: vi.fn(),
  pushChanges: vi.fn(),
  createPR: vi.fn(),
  mergePullRequest: vi.fn(),
  cloneRepo: vi.fn(),
  extractRepoName: vi.fn(),
  openLocalRepo: vi.fn(),
  createGitHubRepo: vi.fn(),
}))

vi.mock('../../src/lib/github/bridge', () => ({
  getAuthState: vi.fn(),
  startDeviceFlow: vi.fn(),
  pollForToken: vi.fn(),
  signOut: vi.fn(),
}))

import { useRepositoryStore } from '../../src/stores/repositoryStore'
import { useChatStore } from '../../src/stores/chatStore'
import * as gitBridge from '../../src/lib/git/bridge'

describe('shipping workspace -> PR flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepositoryStore.setState({
      githubAuth: null,
      isAuthenticating: false,
      authError: null,
      repositories: [
        {
          id: 'repo-1',
          name: 'hatch-sh',
          full_name: 'serrrfirat/hatch-sh',
          clone_url: 'https://github.com/serrrfirat/hatch-sh.git',
          local_path: '/tmp/hatch-sh',
          default_branch: 'master',
          is_private: false,
        },
      ],
      currentRepository: null,
      workspaces: [],
      currentWorkspace: null,
      isCloning: false,
      cloneProgress: null,
    })
    useChatStore.setState({
      messagesByWorkspace: {},
      currentWorkspaceId: null,
      isLoading: false,
      currentProjectId: null,
      pendingOpenPR: null,
    })
  })

  it('creates workspace, commits, pushes, creates and merges PR', async () => {
    vi.mocked(gitBridge.createWorkspaceBranch).mockResolvedValue({
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
    vi.mocked(gitBridge.createPR).mockResolvedValue('https://github.com/serrrfirat/hatch-sh/pull/42')
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

    const commitHash = await useRepositoryStore.getState().commitChanges(workspace.id, 'feat: update')
    expect(commitHash).toBe('abc123')

    await useRepositoryStore.getState().pushChanges(workspace.id)

    const prUrl = await useRepositoryStore.getState().createPullRequest(
      workspace.id,
      'Test PR',
      'Body'
    )
    expect(prUrl).toContain('/pull/42')

    await useRepositoryStore.getState().mergePullRequest(workspace.id)

    const finalWorkspace = useRepositoryStore
      .getState()
      .workspaces.find((w) => w.id === workspace.id)

    expect(finalWorkspace?.prState).toBe('merged')
    expect(finalWorkspace?.prNumber).toBe(42)
  })
})
