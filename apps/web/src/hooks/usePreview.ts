import { useState, useEffect, useCallback, useRef } from 'react'
import { bundleCode, createPreviewBlobUrl } from '../lib/bundler'

interface PreviewState {
  url: string | null
  error: string | null
  isLoading: boolean
}

interface PreviewMessage {
  type: 'error'
  source: 'vibed-preview'
  message: string
  file?: string
  line?: number
  col?: number
}

export function usePreview(code: string | undefined) {
  const [state, setState] = useState<PreviewState>({
    url: null,
    error: null,
    isLoading: false,
  })

  const previousUrlRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<number>()

  // Listen for errors from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent<PreviewMessage>) => {
      // Only process messages from our preview iframe
      if (event.data?.type === 'error' && event.data?.source === 'vibed-preview') {
        setState((prev) => ({
          ...prev,
          error: event.data.message,
        }))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Bundle and create preview URL
  const updatePreview = useCallback(async (sourceCode: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await bundleCode(sourceCode)

      if (result.error) {
        setState({
          url: null,
          error: result.error,
          isLoading: false,
        })
        return
      }

      // Revoke previous blob URL
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current)
      }

      const url = createPreviewBlobUrl(result.code)
      previousUrlRef.current = url

      setState({
        url,
        error: null,
        isLoading: false,
      })
    } catch (error) {
      setState({
        url: null,
        error: error instanceof Error ? error.message : 'Failed to build preview',
        isLoading: false,
      })
    }
  }, [])

  // Debounced code update
  useEffect(() => {
    if (!code) {
      setState({ url: null, error: null, isLoading: false })
      return
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce to avoid rebuilding on every keystroke
    debounceTimerRef.current = window.setTimeout(() => {
      updatePreview(code)
    }, 500)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [code, updatePreview])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current)
      }
    }
  }, [])

  const refresh = useCallback(() => {
    if (code) {
      updatePreview(code)
    }
  }, [code, updatePreview])

  return {
    ...state,
    refresh,
  }
}
