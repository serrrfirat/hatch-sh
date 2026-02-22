import { useIdeaMazeStore } from '../stores/ideaMazeStore'

export interface SaveStatus {
  status: 'saved' | 'saving' | 'unsaved'
  lastSavedAt: Date | null
}

export function useSaveStatus(): SaveStatus {
  const { saveStatus, currentMoodboard } = useIdeaMazeStore()

  return {
    status: saveStatus,
    lastSavedAt: currentMoodboard?.updatedAt ?? null,
  }
}
