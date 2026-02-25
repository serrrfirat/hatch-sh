import { useMemo, useState } from 'react'
import { useChatStore, selectCurrentMessages } from '../../stores/chatStore'
import { getDroppedMessages } from '../../lib/chatWindow'

export const DEFAULT_CONTEXT_LIMIT = 102400

export interface ContextBreakdown {
  userBytes: number
  assistantBytes: number
  toolBytes: number
  totalBytes: number
}

interface MessageLike {
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string
  toolUses?: Array<{
    id: string
    name: string
    input: Record<string, unknown>
    result?: string
    status: 'running' | 'completed' | 'error'
  }>
  images?: Array<{
    id: string
    fileName: string
    mimeType: string
    base64: string
    sizeBytes: number
    savedPath?: string
  }>
}

export function estimateMessageBytes(message: MessageLike): number {
  const safeMessage: Record<string, unknown> = {
    role: message.role,
    content: message.content,
  }

  if (message.thinking) {
    safeMessage.thinking = message.thinking
  }

  if (message.toolUses && message.toolUses.length > 0) {
    safeMessage.toolUses = message.toolUses
  }

  if (message.images && message.images.length > 0) {
    safeMessage.images = message.images.map((image) => ({
      id: image.id,
      fileName: image.fileName,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      savedPath: image.savedPath,
    }))
  }

  return JSON.stringify(safeMessage).length
}

export function calculateContextSize(messages: MessageLike[]): ContextBreakdown {
  let userBytes = 0
  let assistantBytes = 0
  let toolBytes = 0
  let totalBytes = 0
  for (const message of messages) {
    const messageSize = estimateMessageBytes(message)
    totalBytes += messageSize
    if (message.toolUses && message.toolUses.length > 0) {
      const toolSize = JSON.stringify(message.toolUses).length
      toolBytes += toolSize
    }
    switch (message.role) {
      case 'user':
        userBytes += messageSize
        break
      case 'assistant':
        assistantBytes += messageSize
        break
    }
  }
  return {
    userBytes,
    assistantBytes,
    toolBytes,
    totalBytes,
  }
}

export function getContextColor(percentage: number): 'green' | 'yellow' | 'red' {
  if (percentage >= 80) return 'red'
  if (percentage >= 50) return 'yellow'
  return 'green'
}

export function formatBytes(bytes: number): string {
  const kb = Math.round(bytes / 1024)
  return `~${kb}KB`
}

const COLOR_CLASSES = {
  green: {
    bar: 'bg-emerald-500/70',
    text: 'text-emerald-400/70',
  },
  yellow: {
    bar: 'bg-amber-500/70',
    text: 'text-amber-400/70',
  },
  red: {
    bar: 'bg-red-500/80',
    text: 'text-red-400/80',
  },
} as const

export function ContextMeter() {
  const messages = useChatStore(selectCurrentMessages)
  const contextWindowSize = useChatStore((state) => state.contextWindowSize)
  const [showTooltip, setShowTooltip] = useState(false)

  const breakdown = useMemo(() => calculateContextSize(messages as MessageLike[]), [messages])
  const droppedCount = useMemo(
    () => getDroppedMessages(messages, contextWindowSize).length,
    [messages, contextWindowSize]
  )
  const percentage = Math.min(Math.round((breakdown.totalBytes / DEFAULT_CONTEXT_LIMIT) * 100), 100)
  const color = getContextColor(percentage)
  const colorClasses = COLOR_CLASSES[color]
  const isWarning = percentage >= 80

  if (messages.length === 0) return null
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.06]"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="relative flex items-center gap-2 flex-1">
        <span className={`text-[10px] font-mono ${colorClasses.text} whitespace-nowrap`}>
          Context: {formatBytes(breakdown.totalBytes)} / {formatBytes(DEFAULT_CONTEXT_LIMIT)}
        </span>

        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden max-w-[120px]">
          <div
            className={`h-full ${colorClasses.bar} rounded-full transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <span className={`text-[10px] font-mono ${colorClasses.text}`}>{percentage}%</span>

        {isWarning && (
          <span className="text-[10px]" title="Context usage high">
            ⚠️
          </span>
        )}

        {droppedCount > 0 && (
          <span className="text-[10px] font-mono text-white/30 whitespace-nowrap">
            Showing last {messages.length - droppedCount} of {messages.length} messages
          </span>
        )}

        {showTooltip && (
          <div className="absolute top-full left-0 mt-1 z-50 px-3 py-2 bg-gray-800 border border-white/[0.1] rounded-md shadow-xl">
            <span className="text-[10px] font-mono text-white/60 whitespace-nowrap">
              User: {formatBytes(breakdown.userBytes)} | Assistant:{' '}
              {formatBytes(breakdown.assistantBytes)} | Tools: {formatBytes(breakdown.toolBytes)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
