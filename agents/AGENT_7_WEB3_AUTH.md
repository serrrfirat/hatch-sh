# Agent Task: Web3 Authentication (Privy)

## Priority: HIGH - Needed for wallet interactions
## Depends on: Module 1 (Foundation), Module 2 (UI Components)
## Estimated Time: 2-3 hours

## Objective
Integrate Privy for Web3 social login with wallet creation. Users can sign in with Google/Twitter and get an auto-created wallet, or connect their existing wallet.

## Why Privy?
- Best Web3 social login experience
- Embedded wallet (no extension required)
- Supports Google, Twitter, Email, Phone
- Supports WalletConnect, MetaMask, Coinbase
- Easy Base chain configuration

## Tasks

### 1. Install Dependencies
```bash
cd apps/web
pnpm add @privy-io/react-auth @privy-io/wagmi wagmi viem @tanstack/react-query
```

### 2. Get Privy API Key
1. Go to https://dashboard.privy.io
2. Create a new app
3. Get your App ID
4. Configure allowed origins (localhost:5173, vibed.fun)
5. Enable login methods: Google, Twitter, Email, Wallet

### 3. Create Auth Provider
Create `apps/web/src/providers/AuthProvider.tsx`:
```typescript
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider, createConfig } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http } from 'viem'
import { baseSepolia, base } from 'viem/chains'

const queryClient = new QueryClient()

// Configure chains
const chains = [baseSepolia, base] as const

// Wagmi config
const wagmiConfig = createConfig({
  chains,
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
})

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        // Login methods
        loginMethods: ['google', 'twitter', 'email', 'wallet'],

        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#00ff88',
          logo: '/logo.png',
          showWalletLoginFirst: false,
        },

        // Embedded wallet config
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          noPromptOnSignature: false,
        },

        // Default chain
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia, base],

        // External wallets
        externalWallets: {
          coinbaseWallet: {
            connectionOptions: 'smartWalletOnly',
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
```

### 4. Create useAuth Hook
Create `apps/web/src/hooks/useAuth.ts`:
```typescript
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useCallback, useMemo } from 'react'

export function useAuth() {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    linkWallet,
    unlinkWallet,
  } = usePrivy()

  const { wallets } = useWallets()

  // Get the primary wallet (embedded or first external)
  const primaryWallet = useMemo(() => {
    if (!wallets.length) return null

    // Prefer embedded wallet
    const embedded = wallets.find(w => w.walletClientType === 'privy')
    if (embedded) return embedded

    // Otherwise use first wallet
    return wallets[0]
  }, [wallets])

  // Get user display info
  const userInfo = useMemo(() => {
    if (!user) return null

    const email = user.email?.address
    const google = user.google?.email
    const twitter = user.twitter?.username

    return {
      id: user.id,
      email: email || google,
      twitter,
      displayName: twitter ? `@${twitter}` : email || google || 'Anonymous',
      avatar: user.google?.profilePictureUrl || user.twitter?.profilePictureUrl,
    }
  }, [user])

  // Sign message with wallet
  const signMessage = useCallback(async (message: string) => {
    if (!primaryWallet) throw new Error('No wallet connected')

    const provider = await primaryWallet.getEthereumProvider()
    const signature = await provider.request({
      method: 'personal_sign',
      params: [message, primaryWallet.address],
    })

    return signature as string
  }, [primaryWallet])

  return {
    ready,
    authenticated,
    user,
    userInfo,
    wallets,
    primaryWallet,
    address: primaryWallet?.address,
    login,
    logout,
    linkWallet,
    unlinkWallet,
    signMessage,
  }
}
```

### 5. Create Connect Button Component
Create `apps/web/src/components/auth/ConnectButton.tsx`:
```typescript
import { useAuth } from '../../hooks/useAuth'
import { Button, Badge, cn } from '@vibed/ui'
import { useState } from 'react'
import { WalletMenu } from './WalletMenu'

export function ConnectButton() {
  const { ready, authenticated, userInfo, address, login, logout } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  if (!ready) {
    return (
      <Button variant="secondary" disabled>
        Loading...
      </Button>
    )
  }

  if (!authenticated) {
    return (
      <Button variant="primary" onClick={login}>
        Connect
      </Button>
    )
  }

  // Truncate address
  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ''

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-bg-tertiary border border-border hover:border-accent-green',
          'transition-all'
        )}
      >
        {/* Avatar */}
        {userInfo?.avatar ? (
          <img
            src={userInfo.avatar}
            alt=""
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-accent-purple" />
        )}

        {/* User info */}
        <div className="text-left">
          <div className="text-sm font-medium text-white">
            {userInfo?.displayName}
          </div>
          <div className="text-xs text-gray-500">
            {truncatedAddress}
          </div>
        </div>

        {/* Dropdown arrow */}
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <WalletMenu
          onClose={() => setShowMenu(false)}
          onLogout={logout}
        />
      )}
    </div>
  )
}
```

### 6. Create Wallet Menu Component
Create `apps/web/src/components/auth/WalletMenu.tsx`:
```typescript
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { Button, Badge, cn } from '@vibed/ui'

interface WalletMenuProps {
  onClose: () => void
  onLogout: () => void
}

export function WalletMenu({ onClose, onLogout }: WalletMenuProps) {
  const { wallets, address, userInfo, linkWallet } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      // TODO: Show toast
    }
  }

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute right-0 top-full mt-2 w-72 bg-bg-secondary border border-border rounded-xl shadow-xl z-50"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {userInfo?.avatar ? (
            <img src={userInfo.avatar} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-accent-purple" />
          )}
          <div>
            <div className="font-medium text-white">{userInfo?.displayName}</div>
            <div className="text-sm text-gray-500">{userInfo?.email}</div>
          </div>
        </div>
      </div>

      {/* Wallets */}
      <div className="p-4 border-b border-border">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
          Wallets
        </div>
        <div className="space-y-2">
          {wallets.map((wallet) => (
            <div
              key={wallet.address}
              className="flex items-center justify-between p-2 rounded-lg bg-bg-tertiary"
            >
              <div className="flex items-center gap-2">
                <div className="text-sm font-mono text-gray-300">
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </div>
                {wallet.walletClientType === 'privy' && (
                  <Badge variant="info" size="sm">Embedded</Badge>
                )}
              </div>
              <button
                onClick={copyAddress}
                className="text-xs text-gray-500 hover:text-white"
              >
                Copy
              </button>
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2"
          onClick={() => linkWallet()}
        >
          + Link another wallet
        </Button>
      </div>

      {/* Actions */}
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-accent-red hover:bg-accent-red/10"
          onClick={onLogout}
        >
          Disconnect
        </Button>
      </div>
    </motion.div>
  )
}
```

### 7. Create Auth Modal (Optional - Custom Login UI)
Create `apps/web/src/components/auth/AuthModal.tsx`:
```typescript
import { usePrivy } from '@privy-io/react-auth'
import { Modal, Button } from '@vibed/ui'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login } = usePrivy()

  const handleLogin = async () => {
    await login()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect to vibed.fun">
      <div className="space-y-4">
        <p className="text-gray-400 text-sm">
          Connect your wallet or sign in with social to start building.
        </p>

        <Button
          variant="primary"
          className="w-full"
          onClick={handleLogin}
        >
          Connect Wallet
        </Button>

        <p className="text-xs text-gray-600 text-center">
          By connecting, you agree to our Terms of Service
        </p>
      </div>
    </Modal>
  )
}
```

### 8. Update App.tsx to Use Auth Provider
Update `apps/web/src/App.tsx`:
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './providers/AuthProvider'
import { Layout } from './components/layout/Layout'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div>IDE</div>} />
            <Route path="discover" element={<div>Discovery</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

### 9. Update Header with ConnectButton
Update `apps/web/src/components/layout/Header.tsx`:
```typescript
import { Link } from 'react-router-dom'
import { ConnectButton } from '../auth/ConnectButton'

export function Header() {
  return (
    <header className="h-14 border-b border-border flex items-center px-4 bg-bg-secondary">
      {/* Logo */}
      <Link to="/" className="text-xl font-bold text-gradient">
        vibed.fun
      </Link>

      {/* Navigation */}
      <nav className="ml-8 flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-400 hover:text-white transition">
          Build
        </Link>
        <Link to="/discover" className="text-sm text-gray-400 hover:text-white transition">
          Discover
        </Link>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Connect button */}
      <ConnectButton />
    </header>
  )
}
```

## Directory Structure
```
apps/web/src/
├── providers/
│   └── AuthProvider.tsx
├── components/
│   └── auth/
│       ├── ConnectButton.tsx
│       ├── WalletMenu.tsx
│       └── AuthModal.tsx
└── hooks/
    └── useAuth.ts
```

## Environment Variables
```
VITE_PRIVY_APP_ID=your-privy-app-id
```

## Definition of Done
- [ ] Privy SDK configured and working
- [ ] Can sign in with Google/Twitter
- [ ] Embedded wallet auto-created for new users
- [ ] Can connect external wallets (MetaMask, Coinbase)
- [ ] Wallet address displays in header
- [ ] Logout functionality works
- [ ] Base Sepolia chain configured

## Privy Dashboard Settings

### Login Methods
- [x] Google
- [x] Twitter
- [x] Email
- [x] Wallet

### Embedded Wallets
- Network: Base Sepolia (testnet), Base (mainnet)
- Create on login: Yes

### Allowed Origins
- http://localhost:5173
- https://vibed.fun
- https://*.vibed.fun

## Notes
- Privy handles all wallet management complexity
- Embedded wallet is custodial but seamless UX
- Users can export private keys if needed
- Consider adding phone login for broader reach
