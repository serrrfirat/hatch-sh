import { useEffect, useState } from 'react'
import { Badge } from '@vibed/ui'
import { TokenChart } from './TokenChart'

interface TokenStatsProps {
  tokenAddress: string
}

interface Stats {
  price: string
  marketCap: string
  totalSupply: string
  reserveBalance: string
  graduated: boolean
}

export function TokenStats({ tokenAddress }: TokenStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // TODO: Replace mock data with real API call to fetch token stats
    // Example: fetch(`${API_URL}/api/tokens/${tokenAddress}/stats`)
    // The tokenAddress is included in deps to refetch when it changes
    const mockStats: Stats = {
      price: '0.000042',
      marketCap: '4200',
      totalSupply: '100000000',
      reserveBalance: '1.4',
      graduated: false,
    }

    setIsLoading(true)
    // Simulate loading
    setTimeout(() => {
      setStats(mockStats)
      setIsLoading(false)
    }, 1000)
  }, [tokenAddress])

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

  const marketCapUsd = parseFloat(stats.marketCap) * 3000 // Rough ETH price

  return (
    <div className="space-y-4">
      {/* Mini chart */}
      <div className="h-32 bg-bg-tertiary rounded-lg overflow-hidden">
        <TokenChart tokenAddress={tokenAddress} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Price" value={`${stats.price} ETH`} />
        <StatCard
          label="Market Cap"
          value={`$${formatNumber(marketCapUsd)}`}
        />
        <StatCard label="Supply" value={formatNumber(parseFloat(stats.totalSupply))} />
        <StatCard label="Reserve" value={`${stats.reserveBalance} ETH`} />
      </div>

      {/* Graduation progress */}
      <div className="p-3 rounded-lg bg-bg-tertiary">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Graduation Progress</span>
          <Badge variant={stats.graduated ? 'success' : 'info'} size="sm">
            {stats.graduated ? 'Graduated!' : 'Pre-graduation'}
          </Badge>
        </div>
        <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-green to-accent-purple transition-all"
            style={{
              width: `${Math.min(100, (marketCapUsd / 69000) * 100)}%`
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-600">$0</span>
          <span className="text-xs text-gray-600">$69k</span>
        </div>
      </div>

      {/* Token Address */}
      <div className="p-3 rounded-lg bg-bg-tertiary">
        <p className="text-xs text-gray-500 mb-1">Token Address</p>
        <p className="text-xs font-mono text-gray-400 break-all">{tokenAddress}</p>
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
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`
  return num.toFixed(2)
}
