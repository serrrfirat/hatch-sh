import { create } from 'zustand'

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
  messages: Message[]
  isLoading: boolean
  currentProjectId: string | null
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

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  currentProjectId: null,

  addMessage: (message) => {
    const id = crypto.randomUUID()
    const startTime = message.role === 'assistant' ? Date.now() : undefined
    set((state) => ({
      messages: [...state.messages, { ...message, id, timestamp: new Date(), startTime }],
    }))
    return id
  },

  updateMessage: (id, content, isStreaming) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content, isStreaming: isStreaming ?? false } : msg
      ),
    }))
  },

  updateMessageThinking: (id, thinking) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, thinking } : msg
      ),
    }))
  },

  addToolUse: (messageId, tool) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, toolUses: [...(msg.toolUses || []), tool] }
          : msg
      ),
    }))
  },

  updateToolUse: (messageId, toolId, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              toolUses: msg.toolUses?.map((t) =>
                t.id === toolId ? { ...t, ...updates } : t
              ),
            }
          : msg
      ),
    }))
  },

  setMessageDuration: (id) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === id && msg.startTime) {
          const duration = (Date.now() - msg.startTime) / 1000
          return { ...msg, duration }
        }
        return msg
      }),
    }))
  },

  setLoading: (isLoading) => set({ isLoading }),
  setProjectId: (currentProjectId) => set({ currentProjectId }),
  clearMessages: () => set({ messages: [] }),
}))
