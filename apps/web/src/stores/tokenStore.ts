import { create } from 'zustand'

export interface TokenFormData {
  name: string
  symbol: string
  imageUri: string | null
  imageFile: File | null
}

export interface TokenStats {
  address: string
  price: string
  marketCap: string
  holders: number
  volume24h: string
  graduated: boolean
}

export type LaunchStatus = 'idle' | 'deploying' | 'launching' | 'success' | 'error'

interface TokenState {
  // Form state
  formData: TokenFormData
  setFormData: (data: Partial<TokenFormData>) => void
  resetForm: () => void

  // Launch state
  launchStatus: LaunchStatus
  launchError: string | null
  tokenAddress: string | null
  txHash: string | null
  setLaunchStatus: (status: LaunchStatus) => void
  setLaunchError: (error: string | null) => void
  setTokenAddress: (address: string) => void
  setTxHash: (hash: string) => void

  // Token stats (post-launch)
  stats: TokenStats | null
  setStats: (stats: TokenStats | null) => void

  // Reset all state
  resetAll: () => void
}

const defaultFormData: TokenFormData = {
  name: '',
  symbol: '',
  imageUri: null,
  imageFile: null,
}

export const useTokenStore = create<TokenState>((set) => ({
  formData: defaultFormData,
  setFormData: (data) => set((state) => ({
    formData: { ...state.formData, ...data }
  })),
  resetForm: () => set({ formData: defaultFormData }),

  launchStatus: 'idle',
  launchError: null,
  tokenAddress: null,
  txHash: null,
  setLaunchStatus: (launchStatus) => set({ launchStatus }),
  setLaunchError: (launchError) => set({ launchError }),
  setTokenAddress: (tokenAddress) => set({ tokenAddress }),
  setTxHash: (txHash) => set({ txHash }),

  stats: null,
  setStats: (stats) => set({ stats }),

  resetAll: () => set({
    formData: defaultFormData,
    launchStatus: 'idle',
    launchError: null,
    tokenAddress: null,
    txHash: null,
    stats: null,
  }),
}))
