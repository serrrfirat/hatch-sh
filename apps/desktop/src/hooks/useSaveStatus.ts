import { useIdeaMazeStore } from '../stores/ideaMazeStore'

export interface SaveStatus {
  status: 'saved' | 'saving' | 'unsaved'
  lastSavedAt: Date | null
}

export function useSaveStatus(): SaveStatus {
  const { saveStatus, lastSavedAt } = useIdeaMazeStore()

  return {
    status: saveStatus,
    lastSavedAt,
  }
}
