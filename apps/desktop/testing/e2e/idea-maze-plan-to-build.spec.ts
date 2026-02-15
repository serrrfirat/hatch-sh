import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
})

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware')
  return {
    ...actual,
    persist: ((stateCreator: unknown) => stateCreator) as typeof actual.persist,
  }
})

vi.mock('../../src/lib/ideaMaze/storage', () => ({
  initializeStorage: vi.fn().mockResolvedValue(undefined),
  saveMoodboard: vi.fn().mockResolvedValue(undefined),
  loadAllMoodboards: vi.fn().mockResolvedValue([]),
  deleteMoodboard: vi.fn().mockResolvedValue(undefined),
  migrateFromLocalStorage: vi.fn().mockResolvedValue([]),
  saveImageForAIContext: vi.fn().mockResolvedValue('/tmp/img.png'),
}))

vi.mock('../../src/lib/git/bridge', () => ({
  createWorkspaceBranch: vi.fn().mockResolvedValue({
    branch_name: 'ws-ideamaze',
    worktree_path: '/tmp/hatch-sh/.worktrees/ws-ideamaze',
  }),
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

import { useIdeaMazeStore } from '../../src/stores/ideaMazeStore'
import { useRepositoryStore } from '../../src/stores/repositoryStore'
import { useSettingsStore } from '../../src/stores/settingsStore'
import { useChatStore } from '../../src/stores/chatStore'

describe('idea maze -> plan -> build flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useIdeaMazeStore.setState({
      isStorageInitialized: true,
      isLoading: false,
      storageError: null,
      currentMoodboard: null,
      moodboards: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      toolMode: 'select',
      selection: { nodeIds: [], connectionIds: [] },
      connectionFilters: {
        related: true,
        'depends-on': true,
        contradicts: true,
        extends: true,
        alternative: true,
        showAISuggested: true,
      },
      focusMode: false,
      aiSuggestions: [],
      isAIProcessing: false,
      chatMessagesByMoodboard: {},
      isSidebarOpen: true,
      isMinimapVisible: false,
    })

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

    useSettingsStore.setState({ currentPage: 'idea-maze' })
  })

  it('builds from a plan and routes into BYOA workspace context', async () => {
    const ideaStore = useIdeaMazeStore.getState()
    ideaStore.createNewMoodboard('My Ideas')

    const nodeA = ideaStore.addNode({ x: 100, y: 100 }, [
      { type: 'text', id: crypto.randomUUID(), text: 'Mind map for product architecture' },
    ])
    const nodeB = ideaStore.addNode({ x: 450, y: 120 }, [
      { type: 'text', id: crypto.randomUUID(), text: 'Agent harness and release automation' },
    ])

    const connection = ideaStore.addConnection(nodeA.id, nodeB.id, 'extends')
    expect(connection).not.toBeNull()

    const repoStore = useRepositoryStore.getState()
    const ws = await repoStore.createWorkspace('repo-1')
    repoStore.setCurrentWorkspace(ws)

    useChatStore.getState().addMessage({
      role: 'user',
      content: '## Project Plan\n\nPlease help me build this.',
    })

    useSettingsStore.getState().setCurrentPage('byoa')

    const finalMoodboard = useIdeaMazeStore.getState().currentMoodboard
    const currentPage = useSettingsStore.getState().currentPage
    const currentWorkspace = useRepositoryStore.getState().currentWorkspace
    const chatMessages = useChatStore.getState().messagesByWorkspace[ws.id]

    expect(finalMoodboard?.nodes.length).toBe(2)
    expect(finalMoodboard?.connections.length).toBe(1)
    expect(currentWorkspace?.id).toBe(ws.id)
    expect(currentPage).toBe('byoa')
    expect(chatMessages?.[0].content).toContain('Project Plan')
  })
})
