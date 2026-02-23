import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMoodboard } from '../../lib/ideaMaze/types'

vi.mock('../../lib/ideaMaze/storage', () => ({
  initializeStorage: vi.fn(async () => undefined),
  saveMoodboard: vi.fn(async () => undefined),
  loadAllMoodboards: vi.fn(async () => []),
  deleteMoodboard: vi.fn(async () => undefined),
  migrateFromLocalStorage: vi.fn(async () => []),
}))

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
})

import { useIdeaMazeStore } from '../ideaMazeStore'

function createSeedMoodboard() {
  const moodboard = createMoodboard('Undo Test Board')
  return {
    ...moodboard,
    nodes: [],
    connections: [],
  }
}

describe('ideaMazeStore undo/redo', () => {
  beforeEach(() => {
    const moodboard = createSeedMoodboard()

    useIdeaMazeStore.setState({
      moodboards: [moodboard],
      viewport: { x: 0, y: 0, zoom: 1 },
      selection: { nodeIds: [], connectionIds: [] },
    })
    useIdeaMazeStore.getState().setCurrentMoodboard(moodboard)
  })

  it('undoes and redoes node creation', () => {
    const store = useIdeaMazeStore.getState()
    store.addNode({ x: 100, y: 200 })

    expect(useIdeaMazeStore.getState().currentMoodboard?.nodes).toHaveLength(1)
    expect(useIdeaMazeStore.getState().canUndo).toBe(true)

    useIdeaMazeStore.getState().undo()
    expect(useIdeaMazeStore.getState().currentMoodboard?.nodes).toHaveLength(0)
    expect(useIdeaMazeStore.getState().canRedo).toBe(true)

    useIdeaMazeStore.getState().redo()
    expect(useIdeaMazeStore.getState().currentMoodboard?.nodes).toHaveLength(1)
  })

  it('tracks moveNode in undo history', () => {
    const store = useIdeaMazeStore.getState()
    const node = store.addNode({ x: 10, y: 20 })

    store.moveNode(node.id, { x: 200, y: 300 })
    const moved = useIdeaMazeStore.getState().currentMoodboard?.nodes.find((n) => n.id === node.id)
    expect(moved?.position).toEqual({ x: 200, y: 300 })

    useIdeaMazeStore.getState().undo()
    const restored = useIdeaMazeStore
      .getState()
      .currentMoodboard?.nodes.find((n) => n.id === node.id)
    expect(restored?.position).toEqual({ x: 10, y: 20 })
  })

  it('tracks content updates in undo history', () => {
    const store = useIdeaMazeStore.getState()
    const node = store.addNode({ x: 0, y: 0 })

    store.updateNode(node.id, {
      content: [{ type: 'text', id: crypto.randomUUID(), text: 'updated content' }],
    })

    expect(useIdeaMazeStore.getState().currentMoodboard?.nodes[0]?.content).toHaveLength(1)

    useIdeaMazeStore.getState().undo()
    expect(useIdeaMazeStore.getState().currentMoodboard?.nodes[0]?.content).toHaveLength(0)
  })

  it('does not track viewport updates in undo history', () => {
    const store = useIdeaMazeStore.getState()
    store.addNode({ x: 0, y: 0 })

    useIdeaMazeStore.getState().undo()
    expect(useIdeaMazeStore.getState().canUndo).toBe(false)

    store.setViewport({ x: 50, y: 60, zoom: 1.2 })
    expect(useIdeaMazeStore.getState().canUndo).toBe(false)
    expect(useIdeaMazeStore.getState().undo).toBeTypeOf('function')
    expect(useIdeaMazeStore.getState().undo()).toBeUndefined()
  })
})
