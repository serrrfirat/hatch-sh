# Agent Task: Token Launch Panel UI

## Priority: HIGH - Core feature
## Depends on: Module 2 (UI), Module 7 (Auth), Module 9 (Contracts)
## Estimated Time: 3-4 hours

## Objective
Build the token launch panel in the right sidebar where users configure and launch their app tokens on the bonding curve. Includes token form, deploy button, and post-launch stats/chart.

## Tasks

### 1. Install Dependencies
```bash
cd apps/web
pnpm add lightweight-charts @wagmi/core
```

### 2. Create Token Store
Create `apps/web/src/stores/tokenStore.ts`:
```typescript
import { create } from 'zustand'

interface TokenFormData {
  name: string
  symbol: string
  imageUri: string | null
  imageFile: File | null
}

interface TokenStats {
  address: string
  price: bigint
  marketCap: bigint
  holders: number
  volume24h: bigint
  graduated: boolean
}

interface TokenState {
  // Form state
  formData: TokenFormData
  setFormData: (data: Partial<TokenFormData>) => void
  resetForm: () => void

  // Launch state
  isLaunching: boolean
  launchError: string | null
  tokenAddress: string | null
  txHash: string | null
  setLaunching: (launching: boolean) => void
  setLaunchError: (error: string | null) => void
  setTokenAddress: (address: string) => void
  setTxHash: (hash: string) => void

  // Token stats (post-launch)
  stats: TokenStats | null
  setStats: (stats: TokenStats | null) => void
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

  isLaunching: false,
  launchError: null,
  tokenAddress: null,
  txHash: null,
  setLaunching: (isLaunching) => set({ isLaunching }),
  setLaunchError: (launchError) => set({ launchError }),
  setTokenAddress: (tokenAddress) => set({ tokenAddress }),
  setTxHash: (txHash) => set({ txHash }),

  stats: null,
  setStats: (stats) => set({ stats }),
}))
```

### 3. Create useTokenLaunch Hook
Create `apps/web/src/hooks/useTokenLaunch.ts`:
```typescript
import { useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { useTokenStore } from '../stores/tokenStore'
import { bondingCurveAbi, addresses } from '@hatch/contracts-sdk'

export function useTokenLaunch() {
  const {
    formData,
    isLaunching,
    launchError,
    tokenAddress,
    setLaunching,
    setLaunchError,
    setTokenAddress,
    setTxHash,
  } = useTokenStore()

  const { writeContractAsync } = useWriteContract()

  const launchToken = useCallback(async () => {
    if (!formData.name || !formData.symbol) {
      setLaunchError('Name and symbol are required')
      return
    }

    setLaunching(true)
    setLaunchError(null)

    try {
      // Upload image to IPFS if provided
      let imageUri = formData.imageUri || ''
      if (formData.imageFile) {
        // TODO: Upload to IPFS/Pinata
        // imageUri = await uploadToIPFS(formData.imageFile)
      }

      // Call bonding curve contract
      const hash = await writeContractAsync({
        address: addresses.baseSepolia.bondingCurve,
        abi: bondingCurveAbi,
        functionName: 'createToken',
        args: [formData.name, formData.symbol.toUpperCase(), imageUri],
      })

      setTxHash(hash)

      // Wait for transaction and get token address from event
      // This will be handled by the transaction receipt hook

    } catch (error) {
      console.error('Token launch error:', error)
      setLaunchError(error instanceof Error ? error.message : 'Failed to launch token')
      setLaunching(false)
    }
  }, [formData, writeContractAsync, setLaunching, setLaunchError, setTxHash])

  return {
    formData,
    isLaunching,
    launchError,
    tokenAddress,
    launchToken,
  }
}
```

### 4. Create useTokenStats Hook
Create `apps/web/src/hooks/useTokenStats.ts`:
```typescript
import { useReadContract, useWatchContractEvent } from 'wagmi'
import { formatEther } from 'viem'
import { bondingCurveAbi, addresses } from '@hatch/contracts-sdk'

export function useTokenStats(tokenAddress: `0x${string}` | null) {
  // Get token info from contract
  const { data: tokenData } = useReadContract({
    address: addresses.baseSepolia.bondingCurve,
    abi: bondingCurveAbi,
    functionName: 'tokens',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!tokenAddress,
      refetchInterval: 10000, // Refresh every 10s
    },
  })

  // Get current price
  const { data: price } = useReadContract({
    address: addresses.baseSepolia.bondingCurve,
    abi: bondingCurveAbi,
    functionName: 'getPrice',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!tokenAddress,
      refetchInterval: 5000, // Refresh every 5s
    },
  })

  // Format stats
  const stats = tokenData && price ? {
    price: formatEther(price as bigint),
    reserveBalance: formatEther((tokenData as any).reserveBalance || 0n),
    totalSupply: formatEther((tokenData as any).totalSupply || 0n),
    graduated: (tokenData as any).graduated || false,
    marketCap: calculateMarketCap(price as bigint, (tokenData as any).totalSupply || 0n),
  } : null

  return { stats, isLoading: !stats && !!tokenAddress }
}

function calculateMarketCap(price: bigint, supply: bigint): string {
  const mc = (price * supply) / BigInt(1e18)
  return formatEther(mc)
}
```

### 5. Create Token Panel Component
Create `apps/web/src/components/token/TokenPanel.tsx`:
```typescript
import { useTokenStore } from '../../stores/tokenStore'
import { TokenForm } from './TokenForm'
import { TokenStats } from './TokenStats'
import { DeployButton } from './DeployButton'

interface TokenPanelProps {
  projectId: string | null
  isDeployed: boolean
}

export function TokenPanel({ projectId, isDeployed }: TokenPanelProps) {
  const { tokenAddress } = useTokenStore()

  const showLaunchForm = isDeployed && !tokenAddress
  const showStats = !!tokenAddress

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Token
        </h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!isDeployed && (
          <div className="text-center py-8 text-gray-600">
            <p className="text-sm">Deploy your app first to launch a token</p>
          </div>
        )}

        {showLaunchForm && <TokenForm />}
        {showStats && <TokenStats tokenAddress={tokenAddress} />}
      </div>

      {/* Footer with Deploy/Launch button */}
      <div className="p-4 border-t border-border">
        <DeployButton
          projectId={projectId}
          isDeployed={isDeployed}
          hasToken={!!tokenAddress}
        />
      </div>
    </div>
  )
}
```

### 6. Create Token Form Component
Create `apps/web/src/components/token/TokenForm.tsx`:
```typescript
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTokenStore } from '../../stores/tokenStore'
import { Input, Button, cn } from '@hatch/ui'

export function TokenForm() {
  const { formData, setFormData, launchError } = useTokenStore()
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData({ imageFile: file })
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Token Name */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Token Name
        </label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ name: e.target.value })}
          placeholder="My Awesome App"
          maxLength={50}
        />
      </div>

      {/* Token Symbol */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Ticker
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-green">
            $
          </span>
          <Input
            value={formData.symbol}
            onChange={(e) => setFormData({ symbol: e.target.value.toUpperCase() })}
            placeholder="AWESOME"
            maxLength={10}
            className="pl-7 uppercase"
          />
        </div>
      </div>

      {/* Token Image */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Image
        </label>
        <div className="flex items-center gap-3">
          {/* Preview */}
          <div className={cn(
            'w-16 h-16 rounded-xl border-2 border-dashed border-border',
            'flex items-center justify-center overflow-hidden',
            'bg-bg-tertiary'
          )}>
            {imagePreview ? (
              <img src={imagePreview} alt="Token" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🚀</span>
            )}
          </div>

          {/* Upload button */}
          <label className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <Button variant="secondary" size="sm" className="w-full" as="span">
              Upload Image
            </Button>
          </label>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Square image, 500x500px recommended
        </p>
      </div>

      {/* Error message */}
      {launchError && (
        <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/20">
          <p className="text-sm text-accent-red">{launchError}</p>
        </div>
      )}

      {/* Info */}
      <div className="p-3 rounded-lg bg-bg-tertiary">
        <p className="text-xs text-gray-500">
          Your token will launch on a bonding curve. When market cap reaches $69k,
          liquidity graduates to Uniswap.
        </p>
      </div>
    </motion.div>
  )
}
```

### 7. Create Deploy Button Component
Create `apps/web/src/components/token/DeployButton.tsx`:
```typescript
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTokenLaunch } from '../../hooks/useTokenLaunch'
import { Button, cn } from '@hatch/ui'
import { TransactionModal } from './TransactionModal'

interface DeployButtonProps {
  projectId: string | null
  isDeployed: boolean
  hasToken: boolean
}

export function DeployButton({ projectId, isDeployed, hasToken }: DeployButtonProps) {
  const { formData, isLaunching, launchToken } = useTokenLaunch()
  const [showTxModal, setShowTxModal] = useState(false)

  // Determine button state
  const getButtonConfig = () => {
    if (!projectId) {
      return { text: 'Create a project first', disabled: true, variant: 'secondary' as const }
    }
    if (!isDeployed) {
      return { text: '🚀 Deploy App', disabled: false, variant: 'primary' as const, action: 'deploy' }
    }
    if (hasToken) {
      return { text: '✅ Token Launched', disabled: true, variant: 'secondary' as const }
    }
    if (!formData.name || !formData.symbol) {
      return { text: 'Fill token details above', disabled: true, variant: 'secondary' as const }
    }
    return { text: '🚀 Deploy & Launch Token', disabled: false, variant: 'primary' as const, action: 'launch' }
  }

  const config = getButtonConfig()

  const handleClick = async () => {
    if (config.action === 'deploy') {
      // TODO: Trigger deployment
      console.log('Deploy app')
    } else if (config.action === 'launch') {
      setShowTxModal(true)
      await launchToken()
    }
  }

  return (
    <>
      <motion.div
        whileHover={!config.disabled ? { scale: 1.02 } : undefined}
        whileTap={!config.disabled ? { scale: 0.98 } : undefined}
      >
        <Button
          variant={config.variant}
          size="lg"
          className={cn(
            'w-full font-bold text-lg',
            config.variant === 'primary' && !config.disabled && 'animate-glow-pulse',
          )}
          disabled={config.disabled || isLaunching}
          onClick={handleClick}
        >
          {isLaunching ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Launching...
            </span>
          ) : (
            config.text
          )}
        </Button>
      </motion.div>

      <TransactionModal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
      />
    </>
  )
}
```

### 8. Create Transaction Modal
Create `apps/web/src/components/token/TransactionModal.tsx`:
```typescript
import { motion } from 'framer-motion'
import { useTokenStore } from '../../stores/tokenStore'
import { Modal, Button } from '@hatch/ui'
import { Confetti } from '@hatch/ui/animations'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TransactionModal({ isOpen, onClose }: TransactionModalProps) {
  const { isLaunching, tokenAddress, txHash, launchError } = useTokenStore()

  const status = isLaunching ? 'pending' : tokenAddress ? 'success' : launchError ? 'error' : 'idle'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Token Launch">
      <div className="text-center py-4">
        {status === 'pending' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-orange/20 flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-accent-orange" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Launching Token...</h3>
            <p className="text-sm text-gray-500">
              Confirm the transaction in your wallet
            </p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Confetti />
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-green/20 flex items-center justify-center">
              <span className="text-3xl">🚀</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">LFG! Token Launched!</h3>
            <p className="text-sm text-gray-500 mb-4">
              Your token is now live on the bonding curve
            </p>
            <div className="p-3 rounded-lg bg-bg-tertiary mb-4">
              <p className="text-xs text-gray-500 mb-1">Token Address</p>
              <p className="text-sm font-mono text-accent-green break-all">{tokenAddress}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => window.open(`https://basescan.org/token/${tokenAddress}`, '_blank')}
              >
                View on BaseScan
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={onClose}
              >
                WAGMI
              </Button>
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-red/20 flex items-center justify-center">
              <span className="text-3xl">😢</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Launch Failed</h3>
            <p className="text-sm text-accent-red mb-4">{launchError}</p>
            <Button variant="secondary" onClick={onClose}>
              Try Again
            </Button>
          </motion.div>
        )}
      </div>
    </Modal>
  )
}
```

### 9. Create Token Stats Component
Create `apps/web/src/components/token/TokenStats.tsx`:
```typescript
import { useTokenStats } from '../../hooks/useTokenStats'
import { TokenChart } from './TokenChart'
import { Badge, cn } from '@hatch/ui'

interface TokenStatsProps {
  tokenAddress: string
}

export function TokenStats({ tokenAddress }: TokenStatsProps) {
  const { stats, isLoading } = useTokenStats(tokenAddress as `0x${string}`)

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-bg-tertiary rounded-lg" />
        <div className="h-8 bg-bg-tertiary rounded" />
        <div className="h-8 bg-bg-tertiary rounded" />
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-4">
      {/* Mini chart */}
      <div className="h-32 bg-bg-tertiary rounded-lg overflow-hidden">
        <TokenChart tokenAddress={tokenAddress} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Price" value={`${parseFloat(stats.price).toFixed(6)} ETH`} />
        <StatCard
          label="Market Cap"
          value={`$${formatNumber(parseFloat(stats.marketCap) * 3000)}`} // Rough ETH price
        />
        <StatCard label="Supply" value={formatNumber(parseFloat(stats.totalSupply))} />
        <StatCard label="Reserve" value={`${parseFloat(stats.reserveBalance).toFixed(4)} ETH`} />
      </div>

      {/* Graduation progress */}
      <div className="p-3 rounded-lg bg-bg-tertiary">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Graduation Progress</span>
          <Badge variant={stats.graduated ? 'success' : 'warning'} size="sm">
            {stats.graduated ? 'Graduated!' : 'Pre-graduation'}
          </Badge>
        </div>
        <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-green to-accent-purple transition-all"
            style={{
              width: `${Math.min(100, (parseFloat(stats.marketCap) * 3000 / 69000) * 100)}%`
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-600">$0</span>
          <span className="text-xs text-gray-600">$69k</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-bg-tertiary">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function formatNumber(num: number): string {
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
  return num.toFixed(2)
}
```

### 10. Create Token Chart Component
Create `apps/web/src/components/token/TokenChart.tsx`:
```typescript
import { useEffect, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'

interface TokenChartProps {
  tokenAddress: string
}

export function TokenChart({ tokenAddress }: TokenChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888888',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 120,
      rightPriceScale: {
        visible: false,
      },
      timeScale: {
        visible: false,
      },
      crosshair: {
        horzLine: { visible: false },
        vertLine: { visible: false },
      },
    })

    const areaSeries = chart.addAreaSeries({
      lineColor: '#00ff88',
      topColor: 'rgba(0, 255, 136, 0.4)',
      bottomColor: 'rgba(0, 255, 136, 0.0)',
      lineWidth: 2,
    })

    // TODO: Fetch real price history from contract events
    // For now, generate mock data
    const mockData = generateMockPriceData()
    areaSeries.setData(mockData)

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [tokenAddress])

  return <div ref={chartContainerRef} />
}

function generateMockPriceData() {
  const data = []
  const now = Math.floor(Date.now() / 1000)
  let price = 0.001

  for (let i = 0; i < 50; i++) {
    price += (Math.random() - 0.4) * 0.0002 // Slight upward bias
    if (price < 0.0001) price = 0.0001
    data.push({
      time: now - (50 - i) * 3600,
      value: price,
    })
  }

  return data
}
```

## Directory Structure
```
apps/web/src/
├── components/
│   └── token/
│       ├── TokenPanel.tsx
│       ├── TokenForm.tsx
│       ├── TokenStats.tsx
│       ├── TokenChart.tsx
│       ├── DeployButton.tsx
│       └── TransactionModal.tsx
├── hooks/
│   ├── useTokenLaunch.ts
│   └── useTokenStats.ts
└── stores/
    └── tokenStore.ts
```

## Definition of Done
- [ ] Token form collects name, symbol, image
- [ ] Deploy button triggers contract call
- [ ] Transaction modal shows progress
- [ ] Success shows confetti + token address
- [ ] Token stats display after launch
- [ ] Price chart renders
- [ ] Graduation progress shows

## Environment Variables
```
VITE_BONDING_CURVE_ADDRESS=0x... (from contracts deployment)
```

## Notes
- Requires contracts SDK from Module 9
- Requires Privy auth from Module 7
- Image upload to IPFS can be added later (use placeholder for MVP)
- Price history fetched from contract events (mock for MVP)
