import type { DeployStatus, DeployTarget } from '../../hooks/useDeploy'

const TARGET_LABELS: Record<DeployTarget, string> = {
  cloudflare: 'Cloudflare Pages',
  herenow: 'here.now',
  railway: 'Railway',
}

interface DeploymentStatusProps {
  status: DeployStatus
  url: string | null
  error: string | null
  target?: DeployTarget | null
}

function getStatusLabel(status: DeployStatus, target?: DeployTarget | null): string {
  if (status === 'idle') return ''
  if (status === 'deploying') {
    const label = target ? TARGET_LABELS[target] : 'Cloudflare Pages'
    return `Deploying to ${label}...`
  }
  if (status === 'success') return 'Deployment live!'
  return 'Deployment failed'
}

export function DeploymentStatus({ status, url, error, target }: DeploymentStatusProps) {
  if (status === 'idle') return null

  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-center gap-2">
        {status === 'deploying' && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        <span>{getStatusLabel(status, target)}</span>
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
