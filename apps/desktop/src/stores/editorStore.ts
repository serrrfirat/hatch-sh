import { create } from 'zustand'
import { readFile, getFileDiff, type FileContent, type FileDiff } from '../lib/git/bridge'

export interface EditorTab {
  id: string
  type: 'chat' | 'file' | 'diff'
  title: string
  // For file tabs
  filePath?: string
  content?: string
  language?: string
  isLoading?: boolean
  error?: string
  // For diff tabs
  oldContent?: string
  newContent?: string
  isNewFile?: boolean
  isDeleted?: boolean
}

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null

  // Actions
  openFile: (filePath: string, workspacePath: string) => Promise<void>
  openDiff: (filePath: string, repoPath: string) => Promise<void>
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  getChatTab: () => EditorTab
}

// Default chat tab that's always present
const CHAT_TAB: EditorTab = {
  id: 'chat',
  type: 'chat',
  title: 'Chat',
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  tabs: [CHAT_TAB],
  activeTabId: 'chat',

  openFile: async (filePath: string, workspacePath: string) => {
    const fullPath = filePath.startsWith('/') ? filePath : `${workspacePath}/${filePath}`
    const tabId = `file:${fullPath}`
    const fileName = filePath.split('/').pop() || filePath

    // Check if tab already exists
    const existingTab = get().tabs.find((t) => t.id === tabId)
    if (existingTab) {
      set({ activeTabId: tabId })
      return
    }

    // Create new tab in loading state
    const newTab: EditorTab = {
      id: tabId,
      type: 'file',
      title: fileName,
      filePath: fullPath,
      isLoading: true,
    }

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
    }))

    // Load file content
    try {
      const fileContent: FileContent = await readFile(fullPath)
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                content: fileContent.content,
                language: fileContent.language,
                isLoading: false,
              }
            : t
        ),
      }))
    } catch (error) {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                error: error instanceof Error ? error.message : 'Failed to load file',
                isLoading: false,
              }
            : t
        ),
      }))
    }
  },

  openDiff: async (filePath: string, repoPath: string) => {
    const tabId = `diff:${filePath}`
    const fileName = filePath.split('/').pop() || filePath

    // Check if tab already exists
    const existingTab = get().tabs.find((t) => t.id === tabId)
    if (existingTab) {
      set({ activeTabId: tabId })
      return
    }

    // Create new tab in loading state
    const newTab: EditorTab = {
      id: tabId,
      type: 'diff',
      title: fileName,
      filePath: filePath,
      isLoading: true,
    }

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
    }))

    // Load diff content
    try {
      const diff: FileDiff = await getFileDiff(repoPath, filePath)
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                oldContent: diff.old_content,
                newContent: diff.new_content,
                language: diff.language,
                isNewFile: diff.is_new_file,
                isDeleted: diff.is_deleted,
                isLoading: false,
              }
            : t
        ),
      }))
    } catch (error) {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                error: error instanceof Error ? error.message : 'Failed to load diff',
                isLoading: false,
              }
            : t
        ),
      }))
    }
  },

  closeTab: (tabId: string) => {
    // Don't allow closing the chat tab
    if (tabId === 'chat') return

    const state = get()
    const tabIndex = state.tabs.findIndex((t) => t.id === tabId)
    const newTabs = state.tabs.filter((t) => t.id !== tabId)

    // If closing the active tab, switch to another tab
    let newActiveTabId = state.activeTabId
    if (state.activeTabId === tabId) {
      // Try to activate the tab to the left, or the chat tab
      if (tabIndex > 0) {
        newActiveTabId = newTabs[tabIndex - 1]?.id || 'chat'
      } else {
        newActiveTabId = 'chat'
      }
    }

    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
    })
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId })
  },

  getChatTab: () => CHAT_TAB,
}))
