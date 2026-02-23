import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRepositoryStore, type Workspace } from '../repositoryStore'

vi.mock('../../lib/git/bridge', () => ({
  extractRepoName: vi.fn((url: string) => url.split('/').pop()?.replace('.git', '') || 'repo'),
  cloneRepo: vi.fn(async () => ({
    id: 'repo-1',
    name: 'test-repo',
    full_name: 'user/test-repo',
    local_path: '/path/to/repo',
    clone_url: 'https://github.com/user/test-repo.git',
    default_branch: 'main',
    is_private: false,
  })),
  createWorkspaceBranch: vi.fn(async () => ({
    branch_name: 'test-workspace',
    worktree_path: '/path/to/worktree',
  })),
  deleteWorkspaceBranch: vi.fn(async () => undefined),
  getGitStatus: vi.fn(async () => ({
    staged: [],
    modified: [],
    untracked: [],
    deleted: [],
  })),
  commitChanges: vi.fn(async () => 'abc123'),
  pushChanges: vi.fn(async () => undefined),
  createPR: vi.fn(async () => 'https://github.com/user/repo/pull/1'),
  mergePullRequest: vi.fn(async () => ({ merged: true })),
}))

vi.mock('../../lib/github/bridge', () => ({
  checkGhInstalled: vi.fn(async () => true),
  getAuthState: vi.fn(async () => null),
  login: vi.fn(async () => ({
    is_authenticated: true,
    user: { login: 'testuser', avatar_url: '' },
  })),
  signOut: vi.fn(async () => undefined),
  isAuthExpiredError: vi.fn(() => false),
}))

vi.mock('../chatStore', () => ({
  useChatStore: {
    getState: vi.fn(() => ({
      setWorkspaceId: vi.fn(),
    })),
  },
}))

vi.mock('../../lib/pokemon', () => ({
  generateWorkspaceName: vi.fn((existing: string[]) => `workspace-${existing.length + 1}`),
}))

vi.mock('../../lib/agents/registry', () => ({
  DEFAULT_AGENT_ID: 'claude' as const,
  isValidAgentId: vi.fn(() => true),
}))

vi.mock('../settingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      agentMode: 'claude',
      setAuthExpired: vi.fn(),
    })),
  },
}))

const mockStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

vi.stubGlobal('localStorage', mockStorage)

describe('repositoryStore workspace status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRepositoryStore.setState({
      repositories: [],
      workspaces: [],
      currentWorkspace: null,
      currentRepository: null,
    })
  })

  it('creates workspace with status "backlog"', async () => {
    const repo = {
      id: 'repo-1',
      name: 'test-repo',
      full_name: 'user/test-repo',
      local_path: '/path/to/repo',
      clone_url: 'https://github.com/user/test-repo.git',
      default_branch: 'main',
      is_private: false,
    }
    useRepositoryStore.setState({ repositories: [repo] })

    const workspace = await useRepositoryStore.getState().createWorkspace('repo-1')

    expect(workspace.workspaceStatus).toBe('backlog')
    expect(useRepositoryStore.getState().workspaces[0]?.workspaceStatus).toBe('backlog')
  })

  it('transitions status from "backlog" to "in-progress" on first message', () => {
    const workspace: Workspace = {
      id: 'ws-1',
      repositoryId: 'repo-1',
      branchName: 'test-branch',
      localPath: '/path/to/worktree',
      repoPath: '/path/to/repo',
      status: 'idle',
      lastActive: new Date(),
      agentId: 'claude' as const,
      workspaceStatus: 'backlog',
    }
    useRepositoryStore.setState({ workspaces: [workspace] })

    useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-progress')

    expect(useRepositoryStore.getState().workspaces[0]?.workspaceStatus).toBe('in-progress')
  })

  it('transitions status from "in-progress" to "in-review" on PR creation', () => {
    const workspace: Workspace = {
      id: 'ws-1',
      repositoryId: 'repo-1',
      branchName: 'test-branch',
      localPath: '/path/to/worktree',
      repoPath: '/path/to/repo',
      status: 'idle',
      lastActive: new Date(),
      agentId: 'claude' as const,
      workspaceStatus: 'in-progress',
    }
    useRepositoryStore.setState({ workspaces: [workspace] })

    useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-review')

    expect(useRepositoryStore.getState().workspaces[0]?.workspaceStatus).toBe('in-review')
  })

  it('transitions status to "done" on workspace archive', () => {
    const workspace: Workspace = {
      id: 'ws-1',
      repositoryId: 'repo-1',
      branchName: 'test-branch',
      localPath: '/path/to/worktree',
      repoPath: '/path/to/repo',
      status: 'idle',
      lastActive: new Date(),
      agentId: 'claude' as const,
      workspaceStatus: 'in-review',
    }
    useRepositoryStore.setState({ workspaces: [workspace] })

    useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'done')

    expect(useRepositoryStore.getState().workspaces[0]?.workspaceStatus).toBe('done')
  })

  it('allows manual status override via updateWorkspaceWorkflowStatus', () => {
    const workspace: Workspace = {
      id: 'ws-1',
      repositoryId: 'repo-1',
      branchName: 'test-branch',
      localPath: '/path/to/worktree',
      repoPath: '/path/to/repo',
      status: 'idle',
      lastActive: new Date(),
      agentId: 'claude' as const,
      workspaceStatus: 'backlog',
    }
    useRepositoryStore.setState({ workspaces: [workspace] })

    useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'done')

    expect(useRepositoryStore.getState().workspaces[0]?.workspaceStatus).toBe('done')

    useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-progress')

    expect(useRepositoryStore.getState().workspaces[0]?.workspaceStatus).toBe('in-progress')
  })

  it('persists workspace status across app restarts (localStorage)', () => {
    const workspace: Workspace = {
      id: 'ws-1',
      repositoryId: 'repo-1',
      branchName: 'test-branch',
      localPath: '/path/to/worktree',
      repoPath: '/path/to/repo',
      status: 'idle',
      lastActive: new Date(),
      agentId: 'claude' as const,
      workspaceStatus: 'in-progress',
    }
    useRepositoryStore.setState({ workspaces: [workspace] })

    const persisted = useRepositoryStore.getState().workspaces[0]
    expect(persisted?.workspaceStatus).toBe('in-progress')
  })
})
