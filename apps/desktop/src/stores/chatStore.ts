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
  activeStreamingWorkspaces: Set<string>
  loadingByWorkspace: Record<string, boolean>
  currentWorkspaceId: string | null
  isLoading: boolean
  currentProjectId: string | null
  // Pending PR request - set by UI, consumed by ChatArea
  pendingOpenPR: PendingOpenPR | null
  contextWindowSize: number

  // Actions
  setWorkspaceId: (workspaceId: string | null) => void
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>, workspaceId?: string) => string
  updateMessage: (id: string, content: string, isStreaming?: boolean, workspaceId?: string) => void
  updateMessageThinking: (id: string, thinking: string, workspaceId?: string) => void
  addToolUse: (messageId: string, tool: ToolUse, workspaceId?: string) => void
  updateToolUse: (
    messageId: string,
    toolId: string,
    updates: Partial<ToolUse>,
    workspaceId?: string
  ) => void
  updateMessageMetadata: (id: string, metadata: MessageMetadata, workspaceId?: string) => void
  setMessageDuration: (id: string, workspaceId?: string) => void
  setLoading: (loading: boolean, workspaceId?: string) => void
  setProjectId: (id: string) => void
  setContextWindowSize: (size: number) => void
  clearMessages: (workspaceId?: string) => void
  // PR actions
  triggerOpenPR: (uncommittedChanges?: number) => void
  clearPendingOpenPR: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messagesByWorkspace: {},
      activeStreamingWorkspaces: new Set<string>(),
      loadingByWorkspace: {},
      currentWorkspaceId: null,
      isLoading: false,
      currentProjectId: null,
      pendingOpenPR: null,
      contextWindowSize: 20,

      setWorkspaceId: (workspaceId) => {
        set((state) => ({
          currentWorkspaceId: workspaceId,
          isLoading: workspaceId ? Boolean(state.loadingByWorkspace[workspaceId]) : false,
        }))
      },

      addMessage: (message, workspaceId) => {
        const id = crypto.randomUUID()
        const startTime = message.role === 'assistant' ? Date.now() : undefined
        const { currentWorkspaceId } = get()
        const resolvedWorkspaceId = workspaceId ?? currentWorkspaceId

        if (!resolvedWorkspaceId) {
          return id
        }

        set((state) => {
          const currentMessages = state.messagesByWorkspace[resolvedWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [resolvedWorkspaceId]: [
                ...currentMessages,
                { ...message, id, timestamp: new Date(), startTime },
              ],
            },
          }
        })

        // Auto-transition workspace from backlog to in-progress on first message
        const workspace = useRepositoryStore
          .getState()
          .workspaces.find((w) => w.id === resolvedWorkspaceId)
        if (workspace && workspace.workspaceStatus === 'backlog') {
          useRepositoryStore
            .getState()
            .updateWorkspaceWorkflowStatus(resolvedWorkspaceId, 'in-progress')
        }

        return id
      },

      updateMessage: (id, content, isStreaming, workspaceId) => {
        const { currentWorkspaceId } = get()
        const resolvedWorkspaceId = workspaceId ?? currentWorkspaceId
        if (!resolvedWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[resolvedWorkspaceId] || []
          const activeStreamingWorkspaces = new Set(state.activeStreamingWorkspaces)

          if (isStreaming === true) {
            activeStreamingWorkspaces.add(resolvedWorkspaceId)
          }

          if (isStreaming === false) {
            activeStreamingWorkspaces.delete(resolvedWorkspaceId)
          }

          return {
            activeStreamingWorkspaces,
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [resolvedWorkspaceId]: currentMessages.map((msg) =>
                msg.id === id ? { ...msg, content, isStreaming: isStreaming ?? false } : msg
              ),
            },
          }
        })
      },

      updateMessageThinking: (id, thinking, workspaceId) => {
        const { currentWorkspaceId } = get()
        const resolvedWorkspaceId = workspaceId ?? currentWorkspaceId
        if (!resolvedWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[resolvedWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [resolvedWorkspaceId]: currentMessages.map((msg) =>
                msg.id === id ? { ...msg, thinking } : msg
              ),
            },
          }
        })
      },

      addToolUse: (messageId, tool, workspaceId) => {
        const { currentWorkspaceId } = get()
        const resolvedWorkspaceId = workspaceId ?? currentWorkspaceId
        if (!resolvedWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[resolvedWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [resolvedWorkspaceId]: currentMessages.map((msg) =>
                msg.id === messageId ? { ...msg, toolUses: [...(msg.toolUses || []), tool] } : msg
              ),
            },
          }
        })
      },

      updateToolUse: (messageId, toolId, updates, workspaceId) => {
        const { currentWorkspaceId } = get()
        const resolvedWorkspaceId = workspaceId ?? currentWorkspaceId
        if (!resolvedWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[resolvedWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [resolvedWorkspaceId]: currentMessages.map((msg) =>
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

      updateMessageMetadata: (id, metadata, workspaceId) => {
        const { currentWorkspaceId } = get()
        const resolvedWorkspaceId = workspaceId ?? currentWorkspaceId
        if (!resolvedWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[resolvedWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [resolvedWorkspaceId]: currentMessages.map((msg) =>
                msg.id === id ? { ...msg, metadata } : msg
              ),
            },
          }
        })
      },

      setMessageDuration: (id, workspaceId) => {
        const { currentWorkspaceId } = get()
        const resolvedWorkspaceId = workspaceId ?? currentWorkspaceId
        if (!resolvedWorkspaceId) return

        set((state) => {
          const currentMessages = state.messagesByWorkspace[resolvedWorkspaceId] || []
          return {
            messagesByWorkspace: {
              ...state.messagesByWorkspace,
              [resolvedWorkspaceId]: currentMessages.map((msg) => {
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

      setLoading: (loading, workspaceId) => {
        const { currentWorkspaceId } = get()
        const resolvedWorkspaceId = workspaceId ?? currentWorkspaceId

        if (!resolvedWorkspaceId) {
          set({ isLoading: loading })
          return
        }

        set((state) => ({
          loadingByWorkspace: {
            ...state.loadingByWorkspace,
            [resolvedWorkspaceId]: loading,
          },
          isLoading:
            currentWorkspaceId === resolvedWorkspaceId
              ? loading
              : Boolean(state.loadingByWorkspace[currentWorkspaceId || '']),
        }))
      },

      setProjectId: (id) => set({ currentProjectId: id }),

      setContextWindowSize: (size) => set({ contextWindowSize: size }),

      clearMessages: (workspaceId) => {
        const { currentWorkspaceId } = get()
        const resolvedWorkspaceId = workspaceId ?? currentWorkspaceId
        if (!resolvedWorkspaceId) return

        set((state) => ({
          messagesByWorkspace: {
            ...state.messagesByWorkspace,
            [resolvedWorkspaceId]: [],
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
      partialize: (state) => ({
        messagesByWorkspace: state.messagesByWorkspace,
        currentWorkspaceId: state.currentWorkspaceId,
        currentProjectId: state.currentProjectId,
        pendingOpenPR: state.pendingOpenPR,
        contextWindowSize: state.contextWindowSize,
      }),
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

export const selectMessagesForWorkspace = (
  state: ChatState,
  workspaceId: string | null | undefined
): Message[] => {
  if (!workspaceId) return []
  return state.messagesByWorkspace[workspaceId] || []
}
