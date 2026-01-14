import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

interface ChatState {
  messages: Message[]
  isLoading: boolean
  currentProjectId: string | null
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, content: string, isStreaming?: boolean) => void
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
    set((state) => ({
      messages: [...state.messages, { ...message, id, timestamp: new Date() }],
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

  setLoading: (isLoading) => set({ isLoading }),
  setProjectId: (currentProjectId) => set({ currentProjectId }),
  clearMessages: () => set({ messages: [] }),
}))
