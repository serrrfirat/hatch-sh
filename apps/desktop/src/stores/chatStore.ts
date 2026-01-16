import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ToolUse {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  status: 'running' | 'completed' | 'error'
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  /** Thinking text shown during processing */
  thinking?: string
  /** Tool uses during this message */
  toolUses?: ToolUse[]
  /** Duration in seconds */
  duration?: number
  /** Start time for timing */
  startTime?: number
}

interface ChatState {
  // Messages stored per workspace
  messagesByWorkspace: Record<string, Message[]>
  currentWorkspaceId: string | null
  isLoading: boolean
  currentProjectId: string | null

  // Actions
  setWorkspaceId: (workspaceId: string | null) => void
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, content: string, isStreaming?: boolean) => void
  updateMessageThinking: (id: string, thinking: string) => void
  addToolUse: (messageId: string, tool: ToolUse) => void
  updateToolUse: (messageId: string, toolId: string, updates: Partial<ToolUse>) => void
  setMessageDuration: (id: string) => void
  setLoading: (loading: boolean) => void
  setProjectId: (id: string) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messagesByWorkspace: {},
      currentWorkspaceId: null,
      isLoading: false,
      currentProjectId: null,

      setWorkspaceId: (workspaceId) => {
        set({ currentWorkspaceId: workspaceId, isLoading: false })
      },

      addMessage: (message) => {
        const id = crypto.randomUUID()
        const startTime = message.role === 'assistant' ? Date.now() : undefined
        const { currentWorkspaceId } = get()

        if (!currentWorkspaceId) {
          console.warn('No workspace selected, cannot add message')
          return id
        }

        set((state) => {
          const currentMessages = state.messagesByWorkspace[currentWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [currentWorkspaceId]: [
                ...currentMessages,
                { ...message, id, timestamp: new Date(), startTime },
              ],
            },
          }
        })
        return id
      },

      updateMessage: (id, content, isStreaming) => {
        const { currentWorkspaceId } = get()
        if (!currentWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[currentWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [currentWorkspaceId]: currentMessages.map((msg) =>
                msg.id === id ? { ...msg, content, isStreaming: isStreaming ?? false } : msg
              ),
            },
          }
        })
      },

      updateMessageThinking: (id, thinking) => {
        const { currentWorkspaceId } = get()
        if (!currentWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[currentWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [currentWorkspaceId]: currentMessages.map((msg) =>
                msg.id === id ? { ...msg, thinking } : msg
              ),
            },
          }
        })
      },

      addToolUse: (messageId, tool) => {
        const { currentWorkspaceId } = get()
        if (!currentWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[currentWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [currentWorkspaceId]: currentMessages.map((msg) =>
                msg.id === messageId
                  ? { ...msg, toolUses: [...(msg.toolUses || []), tool] }
                  : msg
              ),
            },
          }
        })
      },

      updateToolUse: (messageId, toolId, updates) => {
        const { currentWorkspaceId } = get()
        if (!currentWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[currentWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [currentWorkspaceId]: currentMessages.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      toolUses: msg.toolUses?.map((t) =>
                        t.id === toolId ? { ...t, ...updates } : t
                      ),
                    }
                  : msg
              ),
            },
          }
        })
      },

      setMessageDuration: (id) => {
        const { currentWorkspaceId } = get()
        if (!currentWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[currentWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [currentWorkspaceId]: currentMessages.map((msg) => {
                if (msg.id === id && msg.startTime) {
                  const duration = (Date.now() - msg.startTime) / 1000
                  return { ...msg, duration }
                }
                return msg
              }),
            },
          }
        })
      },

      setLoading: (isLoading) => set({ isLoading }),
      setProjectId: (currentProjectId) => set({ currentProjectId }),

      clearMessages: () => {
        const { currentWorkspaceId } = get()
        if (!currentWorkspaceId) return

        set((state) => ({
          messagesByWorkspace: {
            ...state.messagesByWorkspace,
            [currentWorkspaceId]: [],
          },
        }))
      },
    }),
    {
      name: 'vibed-chat',
      partialize: (state) => ({
        messagesByWorkspace: state.messagesByWorkspace,
      }),
    }
  )
)

// Selector to get messages for the current workspace (reactive)
export const selectCurrentMessages = (state: ChatState): Message[] => {
  const { currentWorkspaceId, messagesByWorkspace } = state
  if (!currentWorkspaceId) return []
  return messagesByWorkspace[currentWorkspaceId] || []
}
