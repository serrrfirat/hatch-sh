import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockZustandPersist,
  createGitBridgeMock,
  createGitHubBridgeMock,
  createIdeaMazeStorageMock,
  setupLocalStorageMock,
  createDefaultRepositoryState,
  createDefaultChatState,
  createTestRepository,
} from '../helpers'

setupLocalStorageMock()

vi.mock('zustand/middleware', async () => mockZustandPersist())
vi.mock('../../src/lib/ideaMaze/storage', () => createIdeaMazeStorageMock())
vi.mock('../../src/lib/git/bridge', () => ({
  ...createGitBridgeMock(),
  createWorkspaceBranch: vi.fn().mockResolvedValue({
    branch_name: 'ws-plan-build',
    worktree_path: '/tmp/hatch-sh/.worktrees/ws-plan-build',
  }),
}))
vi.mock('../../src/lib/github/bridge', () => createGitHubBridgeMock())

import { useIdeaMazeStore } from '../../src/stores/ideaMazeStore'
import { useRepositoryStore } from '../../src/stores/repositoryStore'
import { useSettingsStore } from '../../src/stores/settingsStore'
import { useChatStore } from '../../src/stores/chatStore'
import { createPlanNode } from '../../src/lib/ideaMaze/types'
import type { PlanContent } from '../../src/lib/ideaMaze/types'
import { formatPlanAsMarkdown } from '../../src/lib/ideaMaze/planExporter'

describe('P1-H1: buildFromPlan function', () => {
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
        currentRepository: createTestRepository({ id: 'repo-1' }),
      })
    )

    useChatStore.setState(createDefaultChatState())
    useSettingsStore.setState({ currentPage: 'idea-maze' })
  })

  it('planExporter formats PlanContent to markdown', () => {
    const plan: PlanContent = {
      type: 'plan',
      id: 'plan-1',
      summary: 'Build a CLI tool for deployment',
      requirements: ['Support Docker', 'Support K8s', 'Add rollback'],
      designNotes: 'Use modular architecture',
      technicalApproach: 'Node.js with commander',
      sourceIdeaIds: [],
    }

    const markdown = formatPlanAsMarkdown(plan)

    expect(markdown).toContain('## Plan Summary')
    expect(markdown).toContain('Build a CLI tool for deployment')
    expect(markdown).toContain('## Requirements')
    expect(markdown).toContain('- Support Docker')
    expect(markdown).toContain('- Support K8s')
    expect(markdown).toContain('- Add rollback')
    expect(markdown).toContain('## Design Notes')
    expect(markdown).toContain('## Technical Approach')
  })

  it('planExporter includes source idea references', () => {
    const plan: PlanContent = {
      type: 'plan',
      id: 'plan-2',
      summary: 'Build feature X',
      requirements: ['Req A'],
      sourceIdeaIds: ['idea-abc', 'idea-def'],
    }

    const markdown = formatPlanAsMarkdown(plan)

    expect(markdown).toContain('## Source Ideas')
    expect(markdown).toContain('idea-abc')
    expect(markdown).toContain('idea-def')
  })

  it('buildFromPlan creates workspace and seeds chat', async () => {
    const ideaStore = useIdeaMazeStore.getState()
    ideaStore.createNewMoodboard('Test Moodboard')

    // Add a plan node to the moodboard
    const planNode = createPlanNode(
      { x: 100, y: 100 },
      {
        summary: 'Build a todo app',
        requirements: ['Add tasks', 'Delete tasks', 'Mark complete'],
        designNotes: 'Keep it simple',
        sourceIdeaIds: [],
      },
      'Todo App Plan'
    )

    // Manually add the plan node to the moodboard
    // Add the plan node directly to the moodboard
    const moodboard = useIdeaMazeStore.getState().currentMoodboard!
    useIdeaMazeStore.setState({
      currentMoodboard: {
        ...moodboard,
        nodes: [...moodboard.nodes, planNode],
      },
    })

    await ideaStore.buildFromPlan(planNode.id)

    // Check that a workspace was created
    const workspaces = useRepositoryStore.getState().workspaces
    expect(workspaces.length).toBeGreaterThanOrEqual(1)

    // Check that chat was seeded with the plan
    const currentWsId = useChatStore.getState().currentWorkspaceId
    expect(currentWsId).toBeTruthy()
    const messages = useChatStore.getState().messagesByWorkspace[currentWsId!]
    expect(messages).toBeDefined()
    expect(messages.length).toBeGreaterThanOrEqual(1)
    expect(messages[0].content).toContain('Build a todo app')
  })

  it('buildFromPlan switches to Build tab', async () => {
    const ideaStore = useIdeaMazeStore.getState()
    ideaStore.createNewMoodboard('Test Moodboard')

    const planNode = createPlanNode(
      { x: 0, y: 0 },
      {
        summary: 'Test plan',
        requirements: ['Req 1'],
        sourceIdeaIds: [],
      }
    )

    const moodboard = useIdeaMazeStore.getState().currentMoodboard!
    useIdeaMazeStore.setState({
      currentMoodboard: {
        ...moodboard,
        nodes: [...moodboard.nodes, planNode],
      },
    })

    expect(useSettingsStore.getState().currentPage).toBe('idea-maze')

    await ideaStore.buildFromPlan(planNode.id)

    expect(useSettingsStore.getState().currentPage).toBe('byoa')
  })

  it('buildFromPlan with non-existent node throws', async () => {
    const ideaStore = useIdeaMazeStore.getState()
    ideaStore.createNewMoodboard('Test Moodboard')

    await expect(ideaStore.buildFromPlan('nonexistent')).rejects.toThrow('Node not found')
  })

  it('buildFromPlan with non-plan node throws', async () => {
    const ideaStore = useIdeaMazeStore.getState()
    ideaStore.createNewMoodboard('Test Moodboard')

    // Add a text node (not a plan node)
    const textNode = ideaStore.addNode(
      { x: 100, y: 100 },
      [{ type: 'text', id: 'txt-1', text: 'Just a note' }],
      'Text Node'
    )

    await expect(ideaStore.buildFromPlan(textNode.id)).rejects.toThrow(
      'Node does not contain a plan'
    )
  })
})

describe('P1-H2: Plan reference card', () => {
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
        currentRepository: createTestRepository({ id: 'repo-1' }),
      })
    )

    useChatStore.setState(createDefaultChatState())
    useSettingsStore.setState({ currentPage: 'idea-maze' })
  })

  it('workspace from plan has sourcePlan and sourcePlanId', async () => {
    const ideaStore = useIdeaMazeStore.getState()
    ideaStore.createNewMoodboard('Test Moodboard')

    const planNode = createPlanNode(
      { x: 0, y: 0 },
      {
        summary: 'Plan with reference',
        requirements: ['Feature A'],
        sourceIdeaIds: ['idea-1'],
      }
    )

    const moodboard = useIdeaMazeStore.getState().currentMoodboard!
    useIdeaMazeStore.setState({
      currentMoodboard: {
        ...moodboard,
        nodes: [...moodboard.nodes, planNode],
      },
    })

    await ideaStore.buildFromPlan(planNode.id)

    const workspace = useRepositoryStore.getState().currentWorkspace
    expect(workspace).toBeDefined()
    expect(workspace!.sourcePlan).toBeDefined()
    expect(workspace!.sourcePlan!.summary).toBe('Plan with reference')
    expect(workspace!.sourcePlanId).toBe(planNode.id)
  })

  it('regular workspace has no sourcePlan', async () => {
    const repoStore = useRepositoryStore.getState()
    const ws = await repoStore.createWorkspace('repo-1')

    expect(ws.sourcePlan).toBeUndefined()
    expect(ws.sourcePlanId).toBeUndefined()
  })
})
