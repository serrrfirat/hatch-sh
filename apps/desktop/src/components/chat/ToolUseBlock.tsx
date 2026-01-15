import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ToolUse } from '../../stores/chatStore'

interface ToolUseBlockProps {
  tool: ToolUse
}

// Editorial easing - smooth, elegant motion
const editorialEase = [0.16, 1, 0.3, 1] as const

function getToolDisplayInfo(tool: ToolUse): { action: string; detail: string; fullPath?: string } {
  const name = tool.name.toLowerCase()
  const input = tool.input as Record<string, unknown>

  // Read tool
  if (name.includes('read')) {
    const filePath = (input.file_path || input.path || '') as string
    const fileName = filePath.split('/').pop() || filePath
    const lines = tool.result ? tool.result.split('\n').length : 0
    return {
      action: lines > 0 ? `Read ${lines} lines` : 'Reading',
      detail: fileName,
      fullPath: filePath,
    }
  }

  // Write tool
  if (name.includes('write')) {
    const filePath = (input.file_path || input.path || '') as string
    const fileName = filePath.split('/').pop() || filePath
    const content = (input.content || '') as string
    const lines = content.split('\n').length
    return {
      action: `Wrote ${lines} lines`,
      detail: fileName,
      fullPath: filePath,
    }
  }

  // Edit tool
  if (name.includes('edit')) {
    const filePath = (input.file_path || input.path || '') as string
    const fileName = filePath.split('/').pop() || filePath
    return {
      action: 'Edited',
      detail: fileName,
      fullPath: filePath,
    }
  }

  // Bash/Command tool
  if (name.includes('bash') || name.includes('command')) {
    const command = (input.command || '') as string
    const truncatedCmd = command.length > 50 ? command.slice(0, 50) + '...' : command
    return {
      action: 'Executed',
      detail: truncatedCmd,
    }
  }

  // Search/Grep tool
  if (name.includes('grep') || name.includes('search')) {
    const pattern = (input.pattern || input.query || '') as string
    const matches = tool.result?.split('\n').filter(l => l.trim()).length || 0
    return {
      action: matches > 0 ? `Found ${matches} results` : 'Searching',
      detail: pattern,
    }
  }

  // Glob tool
  if (name.includes('glob')) {
    const pattern = (input.pattern || '') as string
    const matches = tool.result?.split('\n').filter(l => l.trim()).length || 0
    return {
      action: matches > 0 ? `Found ${matches} files` : 'Finding',
      detail: pattern,
    }
  }

  // WebFetch
  if (name.includes('web') || name.includes('fetch')) {
    const url = (input.url || '') as string
    return {
      action: 'Fetched',
      detail: url.length > 40 ? url.slice(0, 40) + '...' : url,
    }
  }

  // Default
  return {
    action: tool.name,
    detail: Object.keys(input).length > 0 ? JSON.stringify(input).slice(0, 50) : '',
  }
}

function StatusIndicator({ status }: { status: ToolUse['status'] }) {
  if (status === 'running') {
    return (
      <motion.div
        className="w-2 h-2 rounded-full bg-white"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      />
    )
  }
  if (status === 'completed') {
    return (
      <motion.svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white/60"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: editorialEase }}
      >
        <polyline points="20 6 9 17 4 12" />
      </motion.svg>
    )
  }
  if (status === 'error') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    )
  }
  return null
}

export function ToolUseBlock({ tool }: ToolUseBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { action, detail, fullPath } = getToolDisplayInfo(tool)

  const hasResult = tool.result && tool.result.length > 0
  const hasInput = Object.keys(tool.input).length > 0
  const canExpand = hasResult || hasInput

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: editorialEase }}
      className="mb-3"
    >
      {/* Header */}
      <button
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`w-full group ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
        disabled={!canExpand}
      >
        <div className="flex items-center gap-4 py-2">
          {/* Status indicator */}
          <StatusIndicator status={tool.status} />

          {/* Action text */}
          <div className="flex-1 text-left flex items-baseline gap-2 min-w-0">
            <span className="text-sm text-white/50 font-medium shrink-0">
              {action}
            </span>
            <code className="text-sm text-white truncate font-mono">
              {detail}
            </code>
          </div>

          {/* Full path on hover */}
          {fullPath && fullPath !== detail && (
            <span className="text-xs text-white/20 font-mono hidden group-hover:block truncate max-w-[200px]">
              {fullPath}
            </span>
          )}

          {/* Expand indicator */}
          {canExpand && (
            <motion.div
              className="text-white/30 group-hover:text-white/50 transition-colors duration-300"
              animate={{ rotate: isExpanded ? 45 : 0 }}
              transition={{ duration: 0.3, ease: editorialEase }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </motion.div>
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (hasResult || hasInput) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: editorialEase }}
            className="overflow-hidden"
          >
            <div className="pl-6 border-l border-white/10 ml-1 mt-2 space-y-4">
              {/* Input */}
              {hasInput && (
                <div>
                  <span className="text-xs font-mono text-white/30 uppercase tracking-wider">
                    Input
                  </span>
                  <pre className="mt-2 text-xs text-white/50 font-mono overflow-x-auto max-h-32 overflow-y-auto leading-relaxed">
                    {JSON.stringify(tool.input, null, 2)}
                  </pre>
                </div>
              )}

              {/* Result */}
              {hasResult && (
                <div>
                  <span className="text-xs font-mono text-white/30 uppercase tracking-wider">
                    Result
                  </span>
                  <pre className="mt-2 text-xs text-white/50 font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {tool.result!.length > 2000
                      ? tool.result!.slice(0, 2000) + '\n\n... truncated'
                      : tool.result}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
