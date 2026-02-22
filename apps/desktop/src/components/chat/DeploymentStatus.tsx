import type { DeployStatus } from '../../hooks/useDeploy'

interface DeploymentStatusProps {
  status: DeployStatus
  url: string | null
  error: string | null
}

const STATUS_LABELS: Record<DeployStatus, string> = {
  idle: '',
  deploying: 'Deploying to Cloudflare Pages...',
  success: 'Deployment live!',
  error: 'Deployment failed',
}

export function DeploymentStatus({ status, url, error }: DeploymentStatusProps) {
  if (status === 'idle') return null

  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-center gap-2">
        {status === 'deploying' && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        <span>{STATUS_LABELS[status]}</span>
      </div>

      {status === 'success' && url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-blue-500 underline"
        >
          {url}
        </a>
      )}

      {status === 'error' && error && (
        <p className="mt-1 text-red-500">{error}</p>
      )}
    </div>
  )
}
