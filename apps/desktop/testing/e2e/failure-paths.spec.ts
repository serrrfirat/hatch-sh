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
import * as gitBridge from '../../src/lib/git/bridge'

describe('failure path matrix', () => {
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
      workspaces: [
        {
          id: 'ws-1',
          repositoryId: 'repo-1',
          branchName: 'ws-1',
          localPath: '/tmp/hatch-sh/.worktrees/ws-1',
          repoPath: '/tmp/hatch-sh',
          status: 'idle',
          lastActive: new Date(),
          agentId: 'claude-code',
        },
      ],
      currentWorkspace: null,
      isCloning: false,
      cloneProgress: null,
    })
  })

  it('marks workspace as error when git push fails', async () => {
    vi.mocked(gitBridge.pushChanges).mockRejectedValue(new Error('missing upstream'))

    await expect(useRepositoryStore.getState().pushChanges('ws-1')).rejects.toThrow('missing upstream')

    const ws = useRepositoryStore.getState().workspaces.find((w) => w.id === 'ws-1')
    expect(ws?.status).toBe('error')
  })

  it('keeps PR metadata unset when push fails before PR creation', async () => {
    vi.mocked(gitBridge.pushChanges).mockRejectedValue(new Error('auth expired'))

    await expect(
      useRepositoryStore.getState().createPullRequest('ws-1', 'title', 'body')
    ).rejects.toThrow('auth expired')

    const ws = useRepositoryStore.getState().workspaces.find((w) => w.id === 'ws-1')
    expect(ws?.prNumber).toBeUndefined()
    expect(ws?.prUrl).toBeUndefined()
    expect(ws?.prState).toBeUndefined()
  })

  it('throws clean error when merge requested with no associated PR', async () => {
    await expect(useRepositoryStore.getState().mergePullRequest('ws-1')).rejects.toThrow(
      'No PR associated with this workspace'
    )
  })
})
