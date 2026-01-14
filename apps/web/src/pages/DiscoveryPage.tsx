import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, Badge, Button } from '@vibed/ui'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

interface DiscoveredApp {
  id: string
  name: string
  description: string
  tokenSymbol: string
  tokenAddress: string
  marketCap: number
  price: number
  creatorAddress: string
  deploymentUrl: string
  createdAt: string
}

export function DiscoveryPage() {
  const [apps, setApps] = useState<DiscoveredApp[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'recent' | 'marketCap' | 'trending'>('recent')

  useEffect(() => {
    fetchApps()
  }, [sortBy])

  const fetchApps = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/discovery?sort=${sortBy}`)
      if (response.ok) {
        const data = await response.json()
        setApps(data.apps || [])
      }
    } catch (error) {
      console.error('Failed to fetch apps:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Discover Apps</h1>
          <p className="text-gray-500 mt-1">Explore apps built by the community</p>
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-green"
          >
            <option value="recent">Recent</option>
            <option value="marketCap">Market Cap</option>
            <option value="trending">Trending</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-bg-tertiary rounded-xl h-48" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && apps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
            <span className="text-3xl">🔍</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No apps yet</h3>
          <p className="text-gray-500 text-sm mb-4">Be the first to build and launch!</p>
          <Button variant="primary" onClick={() => window.location.href = '/'}>
            Start Building
          </Button>
        </div>
      )}

      {/* Apps Grid */}
      {!isLoading && apps.length > 0 && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
        >
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

function AppCard({ app }: { app: DiscoveredApp }) {
  const formatMarketCap = (mc: number) => {
    if (mc >= 1e6) return `$${(mc / 1e6).toFixed(2)}M`
    if (mc >= 1e3) return `$${(mc / 1e3).toFixed(2)}K`
    return `$${mc.toFixed(2)}`
  }

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
      }}
    >
      <Card hoverable className="h-full">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-white">{app.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                by {truncateAddress(app.creatorAddress)}
              </p>
            </div>
            <Badge variant="success" size="sm">
              ${app.tokenSymbol}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-400 mb-4 line-clamp-2">
            {app.description || 'A vibed app'}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-gray-500">Market Cap</p>
              <p className="text-sm font-semibold text-accent-green">
                {formatMarketCap(app.marketCap)}
              </p>
            </div>
            <div className="bg-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-gray-500">Price</p>
              <p className="text-sm font-semibold text-white">
                {app.price.toFixed(6)} ETH
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => window.open(app.deploymentUrl, '_blank')}
            >
              Try App
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={() => window.open(`https://sepolia.basescan.org/token/${app.tokenAddress}`, '_blank')}
            >
              Trade
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
