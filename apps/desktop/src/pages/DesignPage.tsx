import { useState, useEffect, useRef } from 'react'
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react'

const SUPERDESIGN_URL = 'https://app.superdesign.dev/library'

// App header height - webview must be positioned below this
const HEADER_HEIGHT = 40

/**
 * Design Mode Page
 * Embeds Superdesign library directly in the app.
 * The webview is cached and persists when switching tabs.
 */
export function DesignPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const webviewRef = useRef<unknown>(null)

  // Create and manage the embedded webview
  useEffect(() => {
    let mounted = true

    const createOrShowWebview = async () => {
      if (!containerRef.current) return

      // Wait for layout to stabilize
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await new Promise((resolve) => setTimeout(resolve, 50))
      if (!mounted || !containerRef.current) return

      try {
        const { Webview } = await import('@tauri-apps/api/webview')
        const { getCurrentWindow } = await import('@tauri-apps/api/window')

        const rect = containerRef.current.getBoundingClientRect()
        const currentWindow = getCurrentWindow()

        // Ensure webview is positioned below the app header
        const y = Math.max(rect.top, HEADER_HEIGHT)
        const height = rect.height - Math.max(0, HEADER_HEIGHT - rect.top)

        // Check if webview already exists (cached from previous visit)
        const existing = await Webview.getByLabel('superdesign-embed')
        if (existing) {
          // Reuse existing webview - just update position/size and show it
          await existing.setPosition({ type: 'Logical', x: rect.left, y: y })
          await existing.setSize({
            type: 'Logical',
            width: rect.width,
            height: height,
          })
          await existing.show()
          webviewRef.current = existing
          if (mounted) setIsLoading(false)
          return
        }

        // Create new webview
        const newWebview = new Webview(currentWindow, 'superdesign-embed', {
          url: SUPERDESIGN_URL,
          x: rect.left,
          y: y,
          width: rect.width,
          height: height,
          transparent: false,
        })

        webviewRef.current = newWebview

        await newWebview.once('tauri://created', () => {
          if (mounted) setIsLoading(false)
        })

        await newWebview.once('tauri://error', (e: unknown) => {
          console.error('Webview error:', e)
          if (mounted) {
            setError(
              'Failed to load Superdesign. Try opening in external browser.'
            )
            setIsLoading(false)
          }
        })
      } catch (err) {
        console.error('Failed to create webview:', err)
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to create embedded view'
          )
          setIsLoading(false)
        }
      }
    }

    createOrShowWebview()

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && webviewRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const adjustedY = Math.max(rect.top, HEADER_HEIGHT)
        const adjustedHeight = rect.height - Math.max(0, HEADER_HEIGHT - rect.top)
        const wv = webviewRef.current as {
          setPosition: (pos: {
            type: string
            x: number
            y: number
          }) => Promise<void>
          setSize: (size: {
            type: string
            width: number
            height: number
          }) => Promise<void>
        }
        wv.setPosition({ type: 'Logical', x: rect.left, y: adjustedY })
        wv.setSize({ type: 'Logical', width: rect.width, height: adjustedHeight })
      }
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Cleanup: hide webview instead of closing it (for caching)
    return () => {
      mounted = false
      resizeObserver.disconnect()

      // Hide the webview instead of closing it so it can be reused
      // Use an async IIFE to properly handle the hide operation
      ;(async () => {
        try {
          const { Webview } = await import('@tauri-apps/api/webview')
          const webview = await Webview.getByLabel('superdesign-embed')
          if (webview) {
            await webview.hide()
            console.log('Webview hidden successfully')
          }
        } catch (err) {
          console.error('Failed to hide webview:', err)
        }
      })()
    }
  }, [])

  // Handle window resize
  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current && webviewRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const adjustedY = Math.max(rect.top, HEADER_HEIGHT)
        const wv = webviewRef.current as {
          setPosition: (pos: {
            type: string
            x: number
            y: number
          }) => Promise<void>
        }
        wv.setPosition({ type: 'Logical', x: rect.left, y: adjustedY })
      }
    }

    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [])

  const handleOpenExternal = () => {
    window.open(SUPERDESIGN_URL, '_blank')
  }

  return (
    <div className="h-full relative bg-[#0a0a0a]">
      {/* Webview container - full height */}
      <div ref={containerRef} className="absolute inset-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-violet-500 animate-spin" />
              <span className="text-sm text-neutral-400">
                Loading Superdesign...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-4 max-w-sm text-center p-6">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-sm text-neutral-400">{error}</p>
              <button
                onClick={handleOpenExternal}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
              >
                <ExternalLink size={14} />
                Open in Browser
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
