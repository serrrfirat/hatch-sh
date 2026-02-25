import { AlertTriangle, X } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useRepositoryStore } from '../../stores/repositoryStore'

export function AuthExpiredBanner() {
  const authExpired = useSettingsStore((s) => s.authExpired)
  const clearAuthExpired = useSettingsStore((s) => s.clearAuthExpired)
  const loginWithGitHub = useRepositoryStore((s) => s.loginWithGitHub)
  const isAuthenticating = useRepositoryStore((s) => s.isAuthenticating)

  if (!authExpired) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-sm">
      <AlertTriangle size={16} className="flex-shrink-0 text-amber-400" />
      <span className="flex-1">
        GitHub authentication expired. Reconnect to automatically retry your last failed operation.
      </span>
      <button
        onClick={() => {
          void loginWithGitHub()
        }}
        disabled={isAuthenticating}
        className="px-2 py-1 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isAuthenticating ? 'Reconnecting...' : 'Reconnect'}
      </button>
      <button
        onClick={clearAuthExpired}
        className="p-1 rounded hover:bg-white/10 text-amber-400 hover:text-white transition-colors"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
