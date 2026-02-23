import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useRepositoryStore } from './repositoryStore'

import type { ImageAttachmentData } from '../lib/imageAttachment'

export interface ToolUse {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  status: 'running' | 'completed' | 'error'
}

export interface MessageMetadata {
  writtenFiles?: Array<{
    path: string
    size: number
  }>
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
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
  metadata?: MessageMetadata
  images?: ImageAttachmentData[]
}

// Pending PR request info
export interface PendingOpenPR {
  uncommittedChanges?: number
}

interface ChatState {
  // Messages stored per workspace
  messagesByWorkspace: Record<string, Message[]>
  currentWorkspaceId: string | null
  isLoading: boolean
  currentProjectId: string | null
  // Pending PR request - set by UI, consumed by ChatArea
  pendingOpenPR: PendingOpenPR | null
  contextWindowSize: number

  // Actions
  setWorkspaceId: (workspaceId: string | null) => void
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, content: string, isStreaming?: boolean) => void
  updateMessageThinking: (id: string, thinking: string) => void
  addToolUse: (messageId: string, tool: ToolUse) => void
  updateToolUse: (messageId: string, toolId: string, updates: Partial<ToolUse>) => void
  updateMessageMetadata: (id: string, metadata: MessageMetadata) => void
  setMessageDuration: (id: string) => void
  setLoading: (loading: boolean) => void
  setProjectId: (id: string) => void
  setContextWindowSize: (size: number) => void
  clearMessages: () => void
  // PR actions
  triggerOpenPR: (uncommittedChanges?: number) => void
  clearPendingOpenPR: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messagesByWorkspace: {},
      currentWorkspaceId: null,
      isLoading: false,
      currentProjectId: null,
      pendingOpenPR: null,
      contextWindowSize: 20,

      setWorkspaceId: (workspaceId) => {
        set({ currentWorkspaceId: workspaceId, isLoading: false })
      },

      addMessage: (message) => {
        const id = crypto.randomUUID()
        const startTime = message.role === 'assistant' ? Date.now() : undefined
        const { currentWorkspaceId } = get()

        if (!currentWorkspaceId) {
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

        // Auto-transition workspace from backlog to in-progress on first message
        const workspace = useRepositoryStore.getState().workspaces.find(w => w.id === currentWorkspaceId)
        if (workspace && workspace.workspaceStatus === 'backlog') {
          useRepositoryStore.getState().updateWorkspaceWorkflowStatus(currentWorkspaceId, 'in-progress')
        }

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
                      toolUses: (msg.toolUses || []).map((tool) =>
                        tool.id === toolId ? { ...tool, ...updates } : tool
                      ),
                    }
                  : msg
              ),
            },
          }
        })
      },

      updateMessageMetadata: (id, metadata) => {
        const { currentWorkspaceId } = get()
        if (!currentWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[currentWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [currentWorkspaceId]: currentMessages.map((msg) =>
                msg.id === id ? { ...msg, metadata } : msg
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

      setLoading: (loading) => set({ isLoading: loading }),

      setProjectId: (id) => set({ currentProjectId: id }),

      setContextWindowSize: (size) => set({ contextWindowSize: size }),

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

      triggerOpenPR: (uncommittedChanges) => {
        set({ pendingOpenPR: { uncommittedChanges } })
      },

      clearPendingOpenPR: () => {
        set({ pendingOpenPR: null })
      },
    }),
    {
      name: 'chat-store',
    }
  )
)


/**
 * Selector to get current workspace messages
 */
export const selectCurrentMessages = (state: ChatState): Message[] => {
  if (!state.currentWorkspaceId) return []
  return state.messagesByWorkspace[state.currentWorkspaceId] || []
}