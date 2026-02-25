import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMoodboard } from '../../lib/ideaMaze/types'

const { saveMoodboardMock } = vi.hoisted(() => ({
  saveMoodboardMock: vi.fn(async () => undefined),
}))

vi.mock('../../lib/ideaMaze/storage', () => ({
  initializeStorage: vi.fn(async () => undefined),
  saveMoodboard: saveMoodboardMock,
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

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('ideaMazeStore saveStatus transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    saveMoodboardMock.mockReset()
    saveMoodboardMock.mockResolvedValue(undefined)

    const moodboard = createMoodboard('Save Status Board')
    useIdeaMazeStore.setState({
      moodboards: [moodboard],
      currentMoodboard: moodboard,
      viewport: { x: 0, y: 0, zoom: 1 },
      selection: { nodeIds: [], connectionIds: [] },
      saveStatus: 'saved',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves saved -> unsaved -> saving -> saved on successful debounced save', async () => {
    const store = useIdeaMazeStore.getState()

    store.addNode({ x: 20, y: 40 })
    expect(useIdeaMazeStore.getState().saveStatus).toBe('unsaved')

    vi.advanceTimersByTime(1000)
    await flushMicrotasks()

    expect(saveMoodboardMock).toHaveBeenCalled()
    expect(useIdeaMazeStore.getState().saveStatus).toBe('saved')
  })

  it('returns to unsaved when debounced save fails', async () => {
    saveMoodboardMock.mockRejectedValueOnce(new Error('disk full'))

    const store = useIdeaMazeStore.getState()
    store.addNode({ x: 10, y: 10 })

    vi.advanceTimersByTime(1000)
    await flushMicrotasks()

    expect(useIdeaMazeStore.getState().saveStatus).toBe('unsaved')
  })

  it('marks createNewMoodboard as saving then saved after immediate save', async () => {
    useIdeaMazeStore.getState().createNewMoodboard('New Board')
    expect(useIdeaMazeStore.getState().saveStatus).toBe('saving')

    await flushMicrotasks()
    expect(useIdeaMazeStore.getState().saveStatus).toBe('saved')
  })
})
