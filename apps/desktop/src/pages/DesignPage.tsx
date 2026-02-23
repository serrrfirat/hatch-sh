import { useState, useEffect, useRef, useCallback } from 'react'
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react'

const SUPERDESIGN_URL = 'https://app.superdesign.dev/library'

// Rust-side proxy strips X-Frame-Options / CSP headers so the iframe can load.
// On macOS/Linux the custom scheme URL is scheme://localhost/path.
const PROXY_URL = 'hatch-proxy://localhost/library'

export function DesignPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Clean up any leftover native webview from the old implementation
  const hideNativeWebview = useCallback(async () => {
    try {
      const { Webview } = await import('@tauri-apps/api/webview')
      const existing = await Webview.getByLabel('superdesign-embed')
      if (existing) {
        await existing.hide()
        await existing.close()
      }
    } catch {
      // No existing webview to clean up
    }
  }, [])

  useEffect(() => {
    hideNativeWebview()
  }, [hideNativeWebview])

  // Timeout: if the iframe hasn't loaded within 5s (e.g. non-Tauri browser),
  // show error state instead of blocking the UI with an infinite overlay.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading && !error) {
        setError('Superdesign proxy is not available. This feature requires the desktop app.')
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [isLoading, error])

  const handleLoad = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setError('Failed to load Superdesign. The proxy may not be working correctly.')
    setIsLoading(false)
  }

  const handleOpenExternal = () => {
    window.open(SUPERDESIGN_URL, '_blank')
  }

  return (
    <div className="relative h-full min-h-0 flex flex-col bg-[#0a0a0a]">
      {isLoading && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0a]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-violet-500 animate-spin" />
            <span className="text-sm text-neutral-400">Loading Superdesign...</span>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex-1 flex items-center justify-center">
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
      ) : (
        <iframe
          ref={iframeRef}
          src={PROXY_URL}
          onLoad={handleLoad}
          onError={handleError}
          className="flex-1 w-full border-none"
          allow="clipboard-read; clipboard-write"
          title="Superdesign"
        />
      )}
    </div>
  )
}
