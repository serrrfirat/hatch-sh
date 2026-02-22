import { AlertTriangle, X } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'

export function AuthExpiredBanner() {
  const authExpired = useSettingsStore((s) => s.authExpired)
  const clearAuthExpired = useSettingsStore((s) => s.clearAuthExpired)

  if (!authExpired) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-sm">
      <AlertTriangle size={16} className="flex-shrink-0 text-amber-400" />
      <span className="flex-1">
        GitHub authentication expired. Run{' '}
        <code className="px-1 py-0.5 bg-white/10 rounded text-xs font-mono">gh auth login</code> in
        your terminal to re-authenticate.
      </span>
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
