import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaveStatus } from '../useSaveStatus'
import { useIdeaMazeStore } from '../../stores/ideaMazeStore'

vi.mock('../../stores/ideaMazeStore', () => ({
  useIdeaMazeStore: vi.fn(),
}))

describe('useSaveStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns saved status when saveStatus is saved', () => {
    const mockDate = new Date('2025-01-01')
    const mockStore = {
      saveStatus: 'saved' as const,
      currentMoodboard: { updatedAt: mockDate },
    }
    vi.mocked(useIdeaMazeStore).mockReturnValue(mockStore as any)

    const result = useSaveStatus()

    expect(result.status).toBe('saved')
    expect(result.lastSavedAt).toEqual(mockDate)
  })

  it('returns saving status when saveStatus is saving', () => {
    const mockDate = new Date('2025-01-01')
    const mockStore = {
      saveStatus: 'saving' as const,
      currentMoodboard: { updatedAt: mockDate },
    }
    vi.mocked(useIdeaMazeStore).mockReturnValue(mockStore as any)

    const result = useSaveStatus()

    expect(result.status).toBe('saving')
    expect(result.lastSavedAt).toEqual(mockDate)
  })

  it('returns unsaved status when saveStatus is unsaved', () => {
    const mockDate = new Date('2025-01-01')
    const mockStore = {
      saveStatus: 'unsaved' as const,
      currentMoodboard: { updatedAt: mockDate },
    }
    vi.mocked(useIdeaMazeStore).mockReturnValue(mockStore as any)

    const result = useSaveStatus()

    expect(result.status).toBe('unsaved')
    expect(result.lastSavedAt).toEqual(mockDate)
  })

  it('returns null lastSavedAt when no moodboard is loaded', () => {
    const mockStore = {
      saveStatus: 'saved' as const,
      currentMoodboard: null,
    }
    vi.mocked(useIdeaMazeStore).mockReturnValue(mockStore as any)

    const result = useSaveStatus()

    expect(result.status).toBe('saved')
    expect(result.lastSavedAt).toBeNull()
  })
})
