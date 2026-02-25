// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRepositoryStore, type Workspace } from '../repositoryStore'
import { useIdeaMazeStore } from '../ideaMazeStore'
import { createMoodboard, createPlanNode } from '../../lib/ideaMaze/types'
import type { PRDDocument } from '../../lib/context/types'
import * as gitBridge from '../../lib/git/bridge'
import * as githubBridge from '../../lib/github/bridge'

const { mockCopyPRDToWorkspace, mockChatAddMessage, mockSetAuthExpired, mockClearAuthExpired } =
  vi.hoisted(() => ({
    mockCopyPRDToWorkspace: vi.fn(async () => undefined),
    mockChatAddMessage: vi.fn(() => 'msg-1'),
    mockSetAuthExpired: vi.fn(),
    mockClearAuthExpired: vi.fn(),
  }))

// Mock the git and github bridges
vi.mock('zustand/middleware', () => ({
  persist: <T>(fn: T) => fn,
  devtools: <T>(fn: T) => fn,
  subscribeWithSelector: <T>(fn: T) => fn,
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

vi.mock('../../lib/ideaMaze/storage', () => ({
  initializeStorage: vi.fn(async () => undefined),
  saveMoodboard: vi.fn(async () => undefined),
  loadAllMoodboards: vi.fn(async () => []),
  deleteMoodboard: vi.fn(async () => undefined),
  migrateFromLocalStorage: vi.fn(async () => []),
}))

vi.mock('../../lib/context/prdStorage', () => ({
  savePRDToAppData: vi.fn(async () => undefined),
  loadPRDFromAppData: vi.fn(async () => null),
  copyPRDToWorkspace: mockCopyPRDToWorkspace,
  loadPRDFromWorkspace: vi.fn(async () => null),
}))

vi.mock('../settingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      agentMode: 'claude-code',
      setAuthExpired: mockSetAuthExpired,
      clearAuthExpired: mockClearAuthExpired,
      setCurrentPage: vi.fn(),
    })),
  },
}))

vi.mock('../chatStore', () => ({
  useChatStore: {
    getState: vi.fn(() => ({
      setWorkspaceId: vi.fn(),
      addMessage: mockChatAddMessage,
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
    mockCopyPRDToWorkspace.mockClear()
    mockChatAddMessage.mockClear()
    mockSetAuthExpired.mockClear()
    mockClearAuthExpired.mockClear()

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

    useIdeaMazeStore.setState({
      currentMoodboard: null,
      currentPRD: null,
      moodboards: [],
      isAIProcessing: false,
      chatMessagesByMoodboard: {},
      isSidebarOpen: true,
      isMinimapVisible: false,
    })
  })

  function createPRD(overrides?: Partial<PRDDocument>): PRDDocument {
    return {
      id: 'prd-1',
      version: 1,
      createdAt: '2026-02-24T00:00:00.000Z',
      updatedAt: '2026-02-24T00:00:00.000Z',
      plan: {
        type: 'plan',
        id: 'plan-content-1',
        summary: 'Build a todo app',
        requirements: ['Add tasks', 'Delete tasks', 'Mark complete'],
        sourceIdeaIds: ['idea-1'],
      },
      dependencyGraph: [{ fromId: 'idea-1', toId: 'idea-2' }],
      contradictions: [],
      scopeExclusions: [],
      acceptanceCriteria: [],
      metadata: {
        sourceMoodboardId: 'mb-1',
        generatedFrom: 'plan-node-1',
        nodeCount: 2,
        connectionCount: 1,
      },
      ...overrides,
    }
  }

  describe('updateWorkspaceWorkflowStatus', () => {
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
        workspaceStatus: 'backlog',
      }

      useRepositoryStore.setState({ workspaces: [workspace] })

      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-review')

      const updated = useRepositoryStore.getState().workspaces[0]
      expect(updated.workspaceStatus).toBe('in-review')
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
        workspaceStatus: 'in-review',
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

      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-review')

      const current = useRepositoryStore.getState().currentWorkspace
      expect(current?.workspaceStatus).toBe('in-review')
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
      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-review')
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
        workspaceStatus: 'in-review',
      }

      useRepositoryStore.setState({ workspaces: [workspace1, workspace2] })

      useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-1', 'in-review')

      const workspaces = useRepositoryStore.getState().workspaces
      expect(workspaces[0].workspaceStatus).toBe('in-review')
      expect(workspaces[1].workspaceStatus).toBe('in-review') // unchanged
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

  describe('buildFromPlan handoff', () => {
    it('calls copyPRDToWorkspace when currentPRD exists', async () => {
      const repo = {
        id: 'repo-1',
        name: 'test-repo',
        full_name: 'user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        local_path: '/path/to/repo',
        default_branch: 'main',
        is_private: false,
      }
      useRepositoryStore.setState({ repositories: [repo], currentRepository: repo })

      const moodboard = createMoodboard('Build Plan')
      const planNode = createPlanNode(
        { x: 0, y: 0 },
        {
          summary: 'Build a todo app',
          requirements: ['Add tasks', 'Delete tasks', 'Mark complete'],
          sourceIdeaIds: ['idea-1'],
        },
        'Plan'
      )
      const currentPRD = createPRD({
        plan: {
          type: 'plan',
          id: planNode.id,
          summary: 'Build a todo app',
          requirements: ['Add tasks', 'Delete tasks', 'Mark complete'],
          sourceIdeaIds: ['idea-1'],
        },
      })

      useIdeaMazeStore.setState({
        currentMoodboard: { ...moodboard, nodes: [...moodboard.nodes, planNode] },
        currentPRD,
      })

      await useIdeaMazeStore.getState().buildFromPlan(planNode.id)

      expect(mockCopyPRDToWorkspace).toHaveBeenCalledWith(currentPRD, '/path/to/worktree')
    })

    it('seeds chat with structured PRD summary message', async () => {
      const repo = {
        id: 'repo-1',
        name: 'test-repo',
        full_name: 'user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        local_path: '/path/to/repo',
        default_branch: 'main',
        is_private: false,
      }
      useRepositoryStore.setState({ repositories: [repo], currentRepository: repo })

      const moodboard = createMoodboard('Build Plan')
      const planNode = createPlanNode(
        { x: 0, y: 0 },
        {
          summary: 'Build a todo app',
          requirements: ['Add tasks', 'Delete tasks', 'Mark complete'],
          sourceIdeaIds: [],
        }
      )

      useIdeaMazeStore.setState({
        currentMoodboard: { ...moodboard, nodes: [...moodboard.nodes, planNode] },
        currentPRD: createPRD(),
      })

      await useIdeaMazeStore.getState().buildFromPlan(planNode.id)

      expect(mockChatAddMessage).toHaveBeenCalledWith({
        role: 'user',
        content:
          'PRD loaded: 3 requirements, 1 dependencies. Your workspace is ready - start building!',
      })
      expect(mockChatAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('## Build from Plan') })
      )
    })

    it('falls back to generic workspace-ready message when currentPRD is missing', async () => {
      const repo = {
        id: 'repo-1',
        name: 'test-repo',
        full_name: 'user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        local_path: '/path/to/repo',
        default_branch: 'main',
        is_private: false,
      }
      useRepositoryStore.setState({ repositories: [repo], currentRepository: repo })

      const moodboard = createMoodboard('Build Plan')
      const planNode = createPlanNode(
        { x: 0, y: 0 },
        {
          summary: 'Build a todo app',
          requirements: ['Add tasks'],
          sourceIdeaIds: [],
        }
      )

      useIdeaMazeStore.setState({
        currentMoodboard: { ...moodboard, nodes: [...moodboard.nodes, planNode] },
        currentPRD: null,
      })

      await useIdeaMazeStore.getState().buildFromPlan(planNode.id)

      expect(mockCopyPRDToWorkspace).not.toHaveBeenCalled()
      expect(mockChatAddMessage).toHaveBeenCalledWith({
        role: 'user',
        content: 'Workspace ready - start building!',
      })
    })
  })

  describe('auth expiration retry flow', () => {
    it('captures failed push operation and marks auth expired', async () => {
      const workspace: Workspace = {
        id: 'ws-1',
        repositoryId: 'repo-1',
        branchName: 'workspace-1',
        localPath: '/path/to/worktree',
        repoPath: '/path/to/repo',
        status: 'idle',
        lastActive: new Date(),
        agentId: 'claude-code',
        workspaceStatus: 'backlog',
      }

      vi.mocked(gitBridge.pushChanges).mockRejectedValueOnce(new Error('HTTP 401 Bad credentials'))
      vi.mocked(githubBridge.isAuthExpiredError).mockReturnValue(true)

      useRepositoryStore.setState({ workspaces: [workspace], currentWorkspace: workspace })

      await expect(useRepositoryStore.getState().pushChanges('ws-1')).rejects.toThrow()

      expect(mockSetAuthExpired).toHaveBeenCalledWith(true)
      expect(useRepositoryStore.getState().pendingAuthRetry).toEqual({
        type: 'pushChanges',
        workspaceId: 'ws-1',
      })
    })

    it('retries queued operation after login succeeds', async () => {
      const workspace: Workspace = {
        id: 'ws-1',
        repositoryId: 'repo-1',
        branchName: 'workspace-1',
        localPath: '/path/to/worktree',
        repoPath: '/path/to/repo',
        status: 'idle',
        lastActive: new Date(),
        agentId: 'claude-code',
        workspaceStatus: 'backlog',
      }

      vi.mocked(gitBridge.pushChanges).mockResolvedValueOnce(undefined)

      useRepositoryStore.setState({
        workspaces: [workspace],
        currentWorkspace: workspace,
        pendingAuthRetry: {
          type: 'pushChanges',
          workspaceId: 'ws-1',
        },
      })

      await useRepositoryStore.getState().loginWithGitHub()

      expect(gitBridge.pushChanges).toHaveBeenCalledWith('/path/to/worktree', 'workspace-1')
      expect(mockClearAuthExpired).toHaveBeenCalled()
      expect(useRepositoryStore.getState().pendingAuthRetry).toBeNull()
    })
  })
})
