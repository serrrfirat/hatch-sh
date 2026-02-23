// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRepositoryStore, type Workspace } from '../repositoryStore'

// Mock the git and github bridges
vi.mock('zustand/middleware', () => ({
  persist: <T>(fn: T) => fn,
  devtools: <T>(fn: T) => fn,
}))

vi.mock('../../lib/git/bridge', () => ({
  extractRepoName: vi.fn((url: string) => url.split('/').pop()?.replace('.git', '') || 'repo'),
  cloneRepo: vi.fn(async () => ({
    id: 'repo-1',
    name: 'test-repo',
    full_name: 'user/test-repo',
    clone_url: 'https://github.com/user/test-repo.git',
    local_path: '/path/to/repo',
    default_branch: 'main',
  })),
  openLocalRepo: vi.fn(async () => ({
    id: 'repo-1',
    name: 'test-repo',
    full_name: 'user/test-repo',
    clone_url: 'https://github.com/user/test-repo.git',
    local_path: '/path/to/repo',
    default_branch: 'main',
  })),
  createGitHubRepo: vi.fn(async () => ({
    id: 'repo-1',
    name: 'test-repo',
    full_name: 'user/test-repo',
    clone_url: 'https://github.com/user/test-repo.git',
    local_path: '/path/to/repo',
    default_branch: 'main',
  })),
  createWorkspaceBranch: vi.fn(async () => ({
    branch_name: 'workspace-1',
    worktree_path: '/path/to/worktree',
  })),
  worktreeCreate: vi.fn(async () => ({
    branch_name: 'workspace-1',
    worktree_path: '/path/to/worktree',
  })),
  deleteWorkspaceBranch: vi.fn(async () => undefined),
  worktreeRemove: vi.fn(async () => undefined),
  getGitStatus: vi.fn(async () => ({
    staged: [],
    modified: [],
    untracked: [],
  })),
  commitChanges: vi.fn(async () => 'abc123'),
  pushChanges: vi.fn(async () => undefined),
  createPR: vi.fn(async () => 'https://github.com/user/repo/pull/1'),
}))

vi.mock('../../lib/github/bridge', () => ({
  checkGhInstalled: vi.fn(async () => true),
  getAuthState: vi.fn(async () => null),
  login: vi.fn(async () => ({
    is_authenticated: true,
    user: { login: 'testuser', avatar_url: 'https://example.com/avatar.jpg' },
  })),
  signOut: vi.fn(async () => undefined),
  isAuthExpiredError: vi.fn(() => false),
}))

vi.mock('../settingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      agentMode: 'claude-code',
      setAuthExpired: vi.fn(),
    })),
  },
}))

vi.mock('../chatStore', () => ({
  useChatStore: {
    getState: vi.fn(() => ({
      setWorkspaceId: vi.fn(),
    })),
  },
}))

const mockStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(() => {}),
  removeItem: vi.fn(() => {}),
  clear: vi.fn(() => {}),
  key: vi.fn(() => null),
  length: 0,
}

vi.stubGlobal('localStorage', mockStorage)

describe('repositoryStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useRepositoryStore.setState({
      githubAuth: null,
      isAuthenticating: false,
      authError: null,
      isGhInstalled: null,
      repositories: [],
      currentRepository: null,
      workspaces: [],
      currentWorkspace: null,
      isCloning: false,
      cloneProgress: null,
      notifications: [],
    })
  })

  describe('updateWorkspaceWorkflowStatus', () => {
    it('updates workspace status to in-progress', () => {
      const workspace: Workspace = {
        id: 'ws-1',
        repositoryId: 'repo-1',
        branchName: 'feature-branch',
        localPath: '/path/to/workspace',
        repoPath: '/path/to/repo',
        status: 'idle',
        lastActive: new Date(),
        agentId: 'claude-code',
        workspaceStatus: 'backlog',
      }

      useRepositoryStore.setState({ workspaces: [workspace] })

      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-progress')

      const updated = useRepositoryStore.getState().workspaces[0]
      expect(updated.workspaceStatus).toBe('in-progress')
    })

    it('updates workspace status to in-review', () => {
      const workspace: Workspace = {
        id: 'ws-1',
        repositoryId: 'repo-1',
        branchName: 'feature-branch',
        localPath: '/path/to/workspace',
        repoPath: '/path/to/repo',
        status: 'idle',
        lastActive: new Date(),
        agentId: 'claude-code',
        workspaceStatus: 'in-progress',
      }

      useRepositoryStore.setState({ workspaces: [workspace] })

      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-review')

      const updated = useRepositoryStore.getState().workspaces[0]
      expect(updated.workspaceStatus).toBe('in-review')
    })

    it('updates workspace status to done', () => {
      const workspace: Workspace = {
        id: 'ws-1',
        repositoryId: 'repo-1',
        branchName: 'feature-branch',
        localPath: '/path/to/workspace',
        repoPath: '/path/to/repo',
        status: 'idle',
        lastActive: new Date(),
        agentId: 'claude-code',
        workspaceStatus: 'in-review',
      }

      useRepositoryStore.setState({ workspaces: [workspace] })

      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'done')

      const updated = useRepositoryStore.getState().workspaces[0]
      expect(updated.workspaceStatus).toBe('done')
    })

    it('updates currentWorkspace when it matches the workspace being updated', () => {
      const workspace: Workspace = {
        id: 'ws-1',
        repositoryId: 'repo-1',
        branchName: 'feature-branch',
        localPath: '/path/to/workspace',
        repoPath: '/path/to/repo',
        status: 'idle',
        lastActive: new Date(),
        agentId: 'claude-code',
        workspaceStatus: 'backlog',
      }

      useRepositoryStore.setState({
        workspaces: [workspace],
        currentWorkspace: workspace,
      })

      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-progress')

      const current = useRepositoryStore.getState().currentWorkspace
      expect(current?.workspaceStatus).toBe('in-progress')
    })

    it('updates lastActive timestamp', () => {
      const workspace: Workspace = {
        id: 'ws-1',
        repositoryId: 'repo-1',
        branchName: 'feature-branch',
        localPath: '/path/to/workspace',
        repoPath: '/path/to/repo',
        status: 'idle',
        lastActive: new Date('2024-01-01'),
        agentId: 'claude-code',
        workspaceStatus: 'backlog',
      }

      useRepositoryStore.setState({ workspaces: [workspace] })

      const beforeUpdate = new Date()
      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-progress')
      const afterUpdate = new Date()

      const updated = useRepositoryStore.getState().workspaces[0]
      expect(updated.lastActive.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
      expect(updated.lastActive.getTime()).toBeLessThanOrEqual(afterUpdate.getTime())
    })

    it('does not affect other workspaces', () => {
      const workspace1: Workspace = {
        id: 'ws-1',
        repositoryId: 'repo-1',
        branchName: 'feature-1',
        localPath: '/path/to/workspace1',
        repoPath: '/path/to/repo',
        status: 'idle',
        lastActive: new Date(),
        agentId: 'claude-code',
        workspaceStatus: 'backlog',
      }

      const workspace2: Workspace = {
        id: 'ws-2',
        repositoryId: 'repo-1',
        branchName: 'feature-2',
        localPath: '/path/to/workspace2',
        repoPath: '/path/to/repo',
        status: 'idle',
        lastActive: new Date(),
        agentId: 'claude-code',
        workspaceStatus: 'in-progress',
      }

      useRepositoryStore.setState({ workspaces: [workspace1, workspace2] })

      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-progress')

      const workspaces = useRepositoryStore.getState().workspaces
      expect(workspaces[0].workspaceStatus).toBe('in-progress')
      expect(workspaces[1].workspaceStatus).toBe('in-progress') // unchanged
    })
  })

  describe('createWorkspace', () => {
    it('creates workspace with default status backlog', async () => {
      const repo = {
        id: 'repo-1',
        name: 'test-repo',
        full_name: 'user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        local_path: '/path/to/repo',
        default_branch: 'main',
        is_private: false,
      }

      useRepositoryStore.setState({ repositories: [repo] })

      const workspace = await useRepositoryStore.getState().createWorkspace('repo-1')

      expect(workspace.workspaceStatus).toBe('backlog')
    })
  })
})
