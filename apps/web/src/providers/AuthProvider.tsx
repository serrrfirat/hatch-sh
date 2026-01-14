import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth'
import { WagmiProvider, createConfig } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http } from 'viem'
import { baseSepolia, base } from 'viem/chains'
import { createContext, useContext, useMemo, useCallback, type ReactNode } from 'react'

const queryClient = new QueryClient()

// Configure chains
const chains = [baseSepolia, base] as const

// Type for Privy wallet to avoid verbose inline type assertions
interface PrivyWallet {
  address: string
  walletClientType?: string
  getEthereumProvider: () => Promise<{
    request: (args: { method: string; params: unknown[] }) => Promise<unknown>
  }>
}

// Wagmi config
const wagmiConfig = createConfig({
  chains,
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
})

// Auth state type
export interface AuthState {
  ready: boolean
  authenticated: boolean
  user: unknown | null
  userInfo: {
    id: string
    email?: string
    twitter?: string
    displayName: string
    avatar?: string
  } | null
  wallets: unknown[]
  primaryWallet: unknown | null
  address: string | undefined
  login: () => void
  logout: () => void
  linkWallet: () => void
  unlinkWallet: (address: string) => void
  signMessage: (message: string) => Promise<string>
  isConfigured: boolean
}

// Mock auth state
const mockAuthState: AuthState = {
  ready: true,
  authenticated: false,
  user: null,
  userInfo: null,
  wallets: [],
  primaryWallet: null,
  address: undefined,
  login: () => console.warn('Auth not configured - set VITE_PRIVY_APP_ID'),
  logout: () => console.warn('Auth not configured'),
  linkWallet: () => console.warn('Auth not configured'),
  unlinkWallet: () => console.warn('Auth not configured'),
  signMessage: async () => { throw new Error('Auth not configured') },
  isConfigured: false,
}

// Auth context
const AuthContext = createContext<AuthState>(mockAuthState)

export function useAuth() {
  return useContext(AuthContext)
}

// Internal component that uses Privy hooks (only rendered when Privy is configured)
function PrivyAuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, linkWallet, unlinkWallet } = usePrivy()
  const { wallets } = useWallets()

  const primaryWallet = useMemo(() => {
    if (!wallets.length) return null
    const embedded = wallets.find((w) => w.walletClientType === 'privy')
    return embedded || wallets[0]
  }, [wallets])

  const userInfo = useMemo(() => {
    if (!user) return null
    const email = user.email?.address
    const google = user.google?.email
    const twitter = user.twitter?.username || undefined
    return {
      id: user.id,
      email: email || google,
      twitter,
      displayName: twitter ? `@${twitter}` : email || google || 'Anonymous',
      avatar: (user.google as { picture?: string } | undefined)?.picture ||
              (user.twitter as { profile_image_url?: string } | undefined)?.profile_image_url,
    }
  }, [user])

  const signMessage = useCallback(async (message: string) => {
    if (!primaryWallet) throw new Error('No wallet connected')
    const wallet = primaryWallet as PrivyWallet
    const provider = await wallet.getEthereumProvider()
    const signature = await provider.request({
      method: 'personal_sign',
      params: [message, wallet.address],
    })
    return signature as string
  }, [primaryWallet])

  const authState: AuthState = {
    ready,
    authenticated,
    user,
    userInfo,
    wallets,
    primaryWallet,
    address: (primaryWallet as PrivyWallet | null)?.address,
    login,
    logout,
    linkWallet,
    unlinkWallet: unlinkWallet as (address: string) => void,
    signMessage,
    isConfigured: true,
  }

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  )
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID

  // If no Privy app ID, render children with mock auth
  if (!privyAppId) {
    console.warn('VITE_PRIVY_APP_ID not set - auth features disabled')
    return (
      <AuthContext.Provider value={mockAuthState}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </AuthContext.Provider>
    )
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['google', 'twitter', 'email', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#00ff88',
          logo: '/logo.png',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia, base],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <PrivyAuthBridge>
            {children}
          </PrivyAuthBridge>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
