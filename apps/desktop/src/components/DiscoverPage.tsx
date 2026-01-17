import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { letterAnimation, letterContainer } from '@hatch/ui'
import { MasonryGallery, type MasonryItem } from './discovery/MasonryGallery'

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
  thumbnail?: string
}

// Demo apps to show when no real apps exist
const DEMO_APPS: DiscoveredApp[] = [
  {
    id: 'demo-1',
    name: 'Vibe Check',
    description: 'A mood tracking app that helps you stay in touch with your emotions',
    tokenSymbol: 'VIBE',
    tokenAddress: '0x1234567890abcdef1234567890abcdef12345678',
    marketCap: 125000,
    price: 0.0125,
    creatorAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    deploymentUrl: '#',
    createdAt: new Date().toISOString(),
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'demo-2',
    name: 'Pixel Dreams',
    description: 'Generate AI art with a retro pixel aesthetic',
    tokenSymbol: 'PIXEL',
    tokenAddress: '0x2345678901bcdef02345678901bcdef023456789',
    marketCap: 89000,
    price: 0.0089,
    creatorAddress: '0xbcdef12345678901bcdef12345678901bcdef123',
    deploymentUrl: '#',
    createdAt: new Date().toISOString(),
    thumbnail: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'demo-3',
    name: 'Flow State',
    description: 'Productivity timer with ambient sounds and focus modes',
    tokenSymbol: 'FLOW',
    tokenAddress: '0x3456789012cdef013456789012cdef0134567890',
    marketCap: 256000,
    price: 0.0256,
    creatorAddress: '0xcdef123456789012cdef123456789012cdef1234',
    deploymentUrl: '#',
    createdAt: new Date().toISOString(),
    thumbnail: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'demo-4',
    name: 'Crypto Cats',
    description: 'Collect and trade unique digital feline companions',
    tokenSymbol: 'MEOW',
    tokenAddress: '0x4567890123def0124567890123def01245678901',
    marketCap: 512000,
    price: 0.0512,
    creatorAddress: '0xdef1234567890123def1234567890123def12345',
    deploymentUrl: '#',
    createdAt: new Date().toISOString(),
    thumbnail: 'https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'demo-5',
    name: 'Beat Maker',
    description: 'Create and share music beats in your browser',
    tokenSymbol: 'BEAT',
    tokenAddress: '0x5678901234ef01235678901234ef012356789012',
    marketCap: 78000,
    price: 0.0078,
    creatorAddress: '0xef12345678901234ef12345678901234ef123456',
    deploymentUrl: '#',
    createdAt: new Date().toISOString(),
    thumbnail: 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'demo-6',
    name: 'Space Explorer',
    description: 'Interactive 3D journey through our solar system',
    tokenSymbol: 'SPACE',
    tokenAddress: '0x6789012345f012346789012345f0123467890123',
    marketCap: 345000,
    price: 0.0345,
    creatorAddress: '0xf123456789012345f123456789012345f1234567',
    deploymentUrl: '#',
    createdAt: new Date().toISOString(),
    thumbnail: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'demo-7',
    name: 'Zen Garden',
    description: 'Digital meditation space with interactive zen elements',
    tokenSymbol: 'ZEN',
    tokenAddress: '0x7890123456012345789012345601234578901234',
    marketCap: 167000,
    price: 0.0167,
    creatorAddress: '0x0123456789123456012345678912345601234567',
    deploymentUrl: '#',
    createdAt: new Date().toISOString(),
    thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'demo-8',
    name: 'Recipe Remix',
    description: 'AI-powered recipe generator with dietary customization',
    tokenSymbol: 'CHEF',
    tokenAddress: '0x8901234567123456890123456712345689012345',
    marketCap: 98000,
    price: 0.0098,
    creatorAddress: '0x1234567890234567123456789023456712345678',
    deploymentUrl: '#',
    createdAt: new Date().toISOString(),
    thumbnail: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=600&auto=format&fit=crop',
  },
]

// Random heights for masonry layout
const randomHeights = [350, 400, 450, 500, 380, 420, 480, 360, 440, 520]

function AnimatedTitle({ text }: { text: string }) {
  return (
    <h1 className="text-[10vw] md:text-[7vw] lg:text-[5vw] leading-none font-bold tracking-tighter select-none flex overflow-hidden py-[1vw]">
      <motion.div
        variants={letterContainer}
        initial="initial"
        animate="animate"
        className="flex"
      >
        {text.split('').map((char, i) => (
          <motion.span
            key={i}
            variants={letterAnimation}
            className="inline-block relative"
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        ))}
      </motion.div>
    </h1>
  )
}

export function DiscoverPage() {
  const [apps, setApps] = useState<DiscoveredApp[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'recent' | 'marketCap' | 'trending'>('recent')
  const [key, setKey] = useState(0)

  useEffect(() => {
    fetchApps()
  }, [sortBy])

  const fetchApps = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/discovery?sort=${sortBy}`)
      if (response.ok) {
        const data = await response.json()
        // Use demo apps if no real apps exist
        const realApps = data.apps || []
        setApps(realApps.length > 0 ? realApps : DEMO_APPS)
        setKey(prev => prev + 1)
      } else {
        // Fallback to demo apps on error
        setApps(DEMO_APPS)
        setKey(prev => prev + 1)
      }
    } catch (error) {
      console.error('Failed to fetch apps:', error)
      // Fallback to demo apps on error
      setApps(DEMO_APPS)
      setKey(prev => prev + 1)
    } finally {
      setIsLoading(false)
    }
  }

  // Transform apps to MasonryItems
  const masonryItems: MasonryItem[] = apps.map((app, i) => ({
    id: app.id,
    img: app.thumbnail || `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop`,
    height: randomHeights[i % randomHeights.length],
    title: app.name,
    description: app.description,
    tokenSymbol: app.tokenSymbol,
    tokenAddress: app.tokenAddress,
    marketCap: app.marketCap,
    creatorAddress: app.creatorAddress,
    deploymentUrl: app.deploymentUrl,
  }))

  return (
    <div className="h-full overflow-auto bg-neutral-950">
      {/* Hero Section */}
      <section className="relative min-h-[30vh] flex flex-col justify-center px-6 md:px-12 pt-8">
        <AnimatedTitle text="Discover" />
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-lg md:text-xl text-neutral-500 font-medium tracking-tight mt-4 max-w-xl"
        >
          Explore apps built by the community. Find your next favorite creation.
        </motion.p>
      </section>

      {/* Filter Bar */}
      <section className="px-6 md:px-12 py-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-white">
            Latest Apps.
          </h2>

          <div className="flex items-center gap-4">
            <span className="hidden md:block font-mono text-sm text-neutral-600">( _sort )</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
            >
              <option value="recent">Recent</option>
              <option value="marketCap">Market Cap</option>
              <option value="trending">Trending</option>
            </select>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="px-6 md:px-12 pb-12">
        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-neutral-800 rounded-2xl" style={{ height: randomHeights[i % randomHeights.length] }} />
              </div>
            ))}
          </div>
        )}

        {/* Masonry Gallery */}
        {!isLoading && masonryItems.length > 0 && (
          <MasonryGallery
            key={key}
            items={masonryItems}
            animateFrom="bottom"
            blurToFocus={true}
            stagger={0.08}
            scaleOnHover={true}
            hoverScale={0.97}
          />
        )}
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 border-t border-white/10 mt-12 bg-white text-black">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm">
          <p>© 2024 hatch.sh</p>
          <p className="mt-4 md:mt-0">Built with vibes.</p>
        </div>
      </footer>
    </div>
  )
}
