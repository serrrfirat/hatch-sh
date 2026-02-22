import { useState, useCallback, useRef } from 'react'

export type DeployTarget = 'cloudflare' | 'herenow' | 'railway'

export type DeployStatus = 'idle' | 'deploying' | 'success' | 'error'

export interface DeployState {
  status: DeployStatus
  target: DeployTarget | null
  url: string | null
  error: string | null
  deploymentId: string | null
}

export function useDeploy(apiBase: string) {
  const [state, setState] = useState<DeployState>({
    status: 'idle',
    target: null,
    url: null,
    error: null,
    deploymentId: null,
  })
  const eventSourceRef = useRef<EventSource | null>(null)

  const deploy = useCallback(async (projectId: string, target: DeployTarget = 'cloudflare') => {
    setState({ status: 'deploying', target, url: null, error: null, deploymentId: null })

    try {
      const res = await fetch(`${apiBase}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, target }),
      })

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error || 'Deployment request failed')
      }

      const data = await res.json() as { deploymentId: string }
      const { deploymentId } = data
      setState((prev) => ({ ...prev, deploymentId }))

      // Connect to SSE stream
      const es = new EventSource(`${apiBase}/deploy/${deploymentId}/stream`)
      eventSourceRef.current = es

      es.onmessage = (event) => {
        const parsed = JSON.parse(event.data) as { status: string; url?: string; message?: string }

        if (parsed.status === 'live') {
          setState((prev) => ({
            ...prev,
            status: 'success',
            url: parsed.url ?? null,
            error: null,
            deploymentId,
          }))
          es.close()
        } else if (parsed.status === 'failed' || parsed.status === 'error') {
          setState((prev) => ({
            ...prev,
            status: 'error',
            url: null,
            error: parsed.message ?? 'Deployment failed',
            deploymentId,
          }))
          es.close()
        }
      }

      es.onerror = () => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Lost connection to deployment stream',
        }))
        es.close()
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        url: null,
        error: err instanceof Error ? err.message : 'Deployment failed',
        deploymentId: null,
      }))
    }
  }, [apiBase])

  const reset = useCallback(() => {
    eventSourceRef.current?.close()
    setState({ status: 'idle', target: null, url: null, error: null, deploymentId: null })
  }, [])

  return { ...state, deploy, reset }
}
