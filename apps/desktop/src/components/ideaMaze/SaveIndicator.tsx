import { useSaveStatus } from '../../hooks/useSaveStatus'
import { Loader2 } from 'lucide-react'

export function SaveIndicator() {
  const { status, lastSavedAt } = useSaveStatus()

  const getStatusColor = () => {
    switch (status) {
      case 'saved':
        return '#10b981'
      case 'saving':
        return '#f59e0b'
      case 'unsaved':
        return '#eab308'
      default:
        return '#6b7280'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'saved':
        return 'Saved'
      case 'saving':
        return 'Saving...'
      case 'unsaved':
        return 'Unsaved'
      default:
        return ''
    }
  }

  const getRelativeTime = () => {
    if (!lastSavedAt) return ''
    const now = new Date()
    const diffMs = now.getTime() - lastSavedAt.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)

    if (diffSeconds < 60) return `${diffSeconds}s ago`
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    return `${diffHours}h ago`
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-opacity"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        color: '#a1a1a1',
      }}
      title={lastSavedAt ? `Last saved: ${getRelativeTime()}` : 'Not saved yet'}
    >
      {status === 'saving' ? (
        <Loader2 size={12} className="animate-spin" style={{ color: getStatusColor() }} />
      ) : (
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor() }} />
      )}
      <span className={status === 'saved' ? 'opacity-50' : ''}>{getStatusText()}</span>
    </div>
  )
}
