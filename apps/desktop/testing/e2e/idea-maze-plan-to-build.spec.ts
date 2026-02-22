import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockZustandPersist,
  createGitBridgeMock,
  createGitHubBridgeMock,
  createIdeaMazeStorageMock,
  setupLocalStorageMock,
} from '../helpers'
import {
  createDefaultRepositoryState,
  createDefaultChatState,
  createTestRepository,
  createTestMoodboardContent,
} from '../helpers'

setupLocalStorageMock()

vi.mock('zustand/middleware', async () => mockZustandPersist())
vi.mock('../../src/lib/ideaMaze/storage', () => createIdeaMazeStorageMock())
vi.mock('../../src/lib/git/bridge', () => ({
  ...createGitBridgeMock(),
  createWorkspaceBranch: vi.fn().mockResolvedValue({
    branch_name: 'ws-ideamaze',
    worktree_path: '/tmp/hatch-sh/.worktrees/ws-ideamaze',
  }),
}))
vi.mock('../../src/lib/github/bridge', () => createGitHubBridgeMock())

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

    useRepositoryStore.setState(
      createDefaultRepositoryState({
        repositories: [createTestRepository({ id: 'repo-1' })],
      })
    )

    useChatStore.setState(createDefaultChatState())
    useSettingsStore.setState({ currentPage: 'idea-maze' })
  })

  it('builds from a plan and routes into BYOA workspace context', async () => {
    const ideaStore = useIdeaMazeStore.getState()
    ideaStore.createNewMoodboard('My Ideas')

    const nodeA = ideaStore.addNode({ x: 100, y: 100 }, [
      createTestMoodboardContent('Mind map for product architecture'),
    ])
    const nodeB = ideaStore.addNode({ x: 450, y: 120 }, [
      createTestMoodboardContent('Agent harness and release automation'),
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
