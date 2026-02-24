import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning'
  undoCallback?: () => void
  dismissTimeout: number // ms, default 5000
  createdAt: number // Date.now()
}

interface ToastStore {
  toasts: Toast[]
  showToast: (opts: Omit<Toast, 'id' | 'createdAt'>) => string // returns id
  dismissToast: (id: string) => void
  undoToast: (id: string) => void // fires callback then dismisses
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  showToast: (opts) => {
    const id = crypto.randomUUID()
    const toast: Toast = {
      ...opts,
      id,
      createdAt: Date.now(),
    }

    set((state) => ({
      toasts: [...state.toasts, toast],
    }))

    return id
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  undoToast: (id) => {
    const state = get()
    const toast = state.toasts.find((t) => t.id === id)

    if (toast?.undoCallback) {
      toast.undoCallback()
    }

    get().dismissToast(id)
  },
}))
