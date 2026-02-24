import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createMoodboard, createNode, createPlanNode } from '../../lib/ideaMaze/types'
import type { PRDDocument } from '../../lib/context/types'
import type { Moodboard } from '../../lib/ideaMaze/types'

const { mockGeneratePRD, mockSavePRDToAppData, mockShowToast } = vi.hoisted(() => ({
  mockGeneratePRD: vi.fn(),
  mockSavePRDToAppData: vi.fn(async () => undefined),
  mockShowToast: vi.fn(() => 'toast-1'),
}))

vi.mock('../../lib/ideaMaze/storage', () => ({
  initializeStorage: vi.fn(async () => undefined),
  saveMoodboard: vi.fn(async () => undefined),
  loadAllMoodboards: vi.fn(async () => []),
  deleteMoodboard: vi.fn(async () => undefined),
  migrateFromLocalStorage: vi.fn(async () => []),
}))

vi.mock('../../lib/context/prdGenerator', () => ({
  generatePRD: mockGeneratePRD,
}))

vi.mock('../../lib/context/prdStorage', () => ({
  savePRDToAppData: mockSavePRDToAppData,
}))

vi.mock('../toastStore', () => ({
  useToastStore: {
    getState: () => ({
      showToast: mockShowToast,
    }),
  },
}))

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
})

import { useIdeaMazeStore } from '../ideaMazeStore'

function makePRD(overrides?: Partial<PRDDocument>): PRDDocument {
  return {
    id: 'prd-1',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    plan: {
      type: 'plan',
      id: 'plan-c-1',
      summary: 'Widget',
      requirements: ['R1'],
      sourceIdeaIds: ['idea-1'],
    },
    dependencyGraph: [],
    contradictions: [],
    scopeExclusions: [],
    acceptanceCriteria: [],
    metadata: {
      sourceMoodboardId: 'mb-1',
      generatedFrom: 'plan-node-1',
      nodeCount: 2,
      connectionCount: 0,
    },
    ...overrides,
  }
}

function seedMoodboard(): Moodboard {
  const mb = createMoodboard('Test Board')
  const ideaNode = createNode(
    { x: 0, y: 0 },
    [{ type: 'text', id: 'tc-1', text: 'Idea A' }],
    'Idea A'
  )
  const planNode = createPlanNode(
    { x: 200, y: 0 },
    { summary: 'Widget', requirements: ['R1'], sourceIdeaIds: [ideaNode.id] },
    'Plan'
  )
  return {
    ...mb,
    id: 'mb-1',
    nodes: [ideaNode, { ...planNode, id: 'plan-node-1' }],
    connections: [],
  }
}

describe('ideaMazeStore - PRD auto-regeneration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGeneratePRD.mockReset()
    mockSavePRDToAppData.mockReset()
    mockShowToast.mockReset()
    mockGeneratePRD.mockReturnValue(makePRD({ id: 'regen-prd' }))
    mockSavePRDToAppData.mockResolvedValue(undefined)

    // Reset to clean state — subscription sees null PRD and clears snapshot
    useIdeaMazeStore.setState({
      currentPRD: null,
      currentMoodboard: null,
      isAIProcessing: false,
      moodboards: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('regenerates PRD when node count changes (significant)', () => {
    const mb = seedMoodboard()
    const prd = makePRD()

    // Seed snapshot
    useIdeaMazeStore.setState({ currentMoodboard: mb, currentPRD: prd })

    // Add node → significant change
    const extra = createNode({ x: 400, y: 0 }, [{ type: 'text', id: 'tc-x', text: 'X' }])
    useIdeaMazeStore.setState({
      currentMoodboard: { ...mb, nodes: [...mb.nodes, extra] },
    })

    vi.advanceTimersByTime(2100)

    expect(mockGeneratePRD).toHaveBeenCalledOnce()
    expect(useIdeaMazeStore.getState().currentPRD?.id).toBe('regen-prd')
  })

  it('regenerates PRD when connection count changes (significant)', () => {
    const mb = seedMoodboard()
    const prd = makePRD()

    useIdeaMazeStore.setState({ currentMoodboard: mb, currentPRD: prd })

    useIdeaMazeStore.setState({
      currentMoodboard: {
        ...mb,
        connections: [
          {
            id: 'conn-1',
            sourceId: mb.nodes[0].id,
            targetId: mb.nodes[1].id,
            type: 'solid' as const,
            relationship: 'related' as const,
          },
        ],
      },
    })

    vi.advanceTimersByTime(2100)

    expect(mockGeneratePRD).toHaveBeenCalledOnce()
  })

  it('does NOT regenerate on position-only change (insignificant)', () => {
    const mb = seedMoodboard()
    const prd = makePRD()

    useIdeaMazeStore.setState({ currentMoodboard: mb, currentPRD: prd })

    // Move a node — structure unchanged
    useIdeaMazeStore.setState({
      currentMoodboard: {
        ...mb,
        nodes: mb.nodes.map((n, i) => (i === 0 ? { ...n, position: { x: 999, y: 999 } } : n)),
      },
    })

    vi.advanceTimersByTime(3000)

    expect(mockGeneratePRD).not.toHaveBeenCalled()
  })

  it('does NOT regenerate when currentPRD is null', () => {
    const mb = seedMoodboard()

    useIdeaMazeStore.setState({ currentMoodboard: mb, currentPRD: null })

    const extra = createNode({ x: 400, y: 0 })
    useIdeaMazeStore.setState({
      currentMoodboard: { ...mb, nodes: [...mb.nodes, extra] },
    })

    vi.advanceTimersByTime(3000)

    expect(mockGeneratePRD).not.toHaveBeenCalled()
  })

  it('does NOT regenerate when isAIProcessing is true', () => {
    const mb = seedMoodboard()
    const prd = makePRD()

    useIdeaMazeStore.setState({
      currentMoodboard: mb,
      currentPRD: prd,
      isAIProcessing: true,
    })

    const extra = createNode({ x: 400, y: 0 })
    useIdeaMazeStore.setState({
      currentMoodboard: { ...mb, nodes: [...mb.nodes, extra] },
    })

    vi.advanceTimersByTime(3000)

    expect(mockGeneratePRD).not.toHaveBeenCalled()
  })

  it('shows "PRD updated" toast with working undo', () => {
    const mb = seedMoodboard()
    const original = makePRD({ id: 'original' })

    useIdeaMazeStore.setState({ currentMoodboard: mb, currentPRD: original })

    const extra = createNode({ x: 400, y: 0 })
    useIdeaMazeStore.setState({
      currentMoodboard: { ...mb, nodes: [...mb.nodes, extra] },
    })

    vi.advanceTimersByTime(2100)

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'PRD updated',
        type: 'info',
        undoCallback: expect.any(Function),
      })
    )

    // Exercise undo
    const toastCalls = mockShowToast.mock.calls as unknown as [[{ undoCallback: () => void }]]
    toastCalls[0][0].undoCallback()
    expect(useIdeaMazeStore.getState().currentPRD?.id).toBe('original')
  })
})
