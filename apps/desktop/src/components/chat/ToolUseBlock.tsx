import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ToolUse } from '../../stores/chatStore'

interface ToolUseBlockProps {
  tool: ToolUse
}

// Smooth easing for animations
const smoothEase = [0.4, 0, 0.2, 1] as const

function getToolDisplayInfo(tool: ToolUse): { action: string; detail: string; fullPath?: string } {
  const name = tool.name.toLowerCase()
  const input = tool.input as Record<string, unknown>

  // Read tool
  if (name.includes('read')) {
    const filePath = (input.file_path || input.path || '') as string
    const fileName = filePath.split('/').pop() || filePath
    const lines = tool.result ? tool.result.split('\n').length : 0
    return {
      action: lines > 0 ? `Read ${lines} lines` : 'Read',
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
      action: `Write ${lines} lines`,
      detail: fileName,
      fullPath: filePath,
    }
  }

  // Edit tool
  if (name.includes('edit')) {
    const filePath = (input.file_path || input.path || '') as string
    const fileName = filePath.split('/').pop() || filePath
    return {
      action: 'Edit',
      detail: fileName,
      fullPath: filePath,
    }
  }

  // Bash/Command tool
  if (name.includes('bash') || name.includes('command')) {
    const command = (input.command || '') as string
    const truncatedCmd = command.length > 60 ? command.slice(0, 60) + '...' : command
    return {
      action: 'Run',
      detail: truncatedCmd,
    }
  }

  // Search/Grep tool
  if (name.includes('grep') || name.includes('search')) {
    const pattern = (input.pattern || input.query || '') as string
    const matches = tool.result?.split('\n').filter(l => l.trim()).length || 0
    return {
      action: matches > 0 ? `Search (${matches})` : 'Search',
      detail: pattern,
    }
  }

  // Glob tool
  if (name.includes('glob')) {
    const pattern = (input.pattern || '') as string
    const matches = tool.result?.split('\n').filter(l => l.trim()).length || 0
    return {
      action: matches > 0 ? `Glob (${matches})` : 'Glob',
      detail: pattern,
    }
  }

  // WebFetch
  if (name.includes('web') || name.includes('fetch')) {
    const url = (input.url || '') as string
    return {
      action: 'Fetch',
      detail: url.length > 50 ? url.slice(0, 50) + '...' : url,
    }
  }

  // Default
  return {
    action: tool.name,
    detail: Object.keys(input).length > 0 ? JSON.stringify(input).slice(0, 60) : '',
  }
}

// Chevron icon for expandable sections
function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <motion.svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/30"
      animate={{ rotate: isExpanded ? 90 : 0 }}
      transition={{ duration: 0.15, ease: smoothEase }}
    >
      <polyline points="9 18 15 12 9 6" />
    </motion.svg>
  )
}

// Pulsing activity indicator
function ActivityIndicator() {
  return (
    <motion.div
      className="w-1.5 h-1.5 rounded-full bg-blue-400"
      animate={{ opacity: [1, 0.4, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

// Checkmark for completed
function CheckIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-green-400/60"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// Error icon
function ErrorIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-red-400/60"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function StatusIcon({ status, canExpand, isExpanded }: { status: ToolUse['status']; canExpand: boolean; isExpanded: boolean }) {
  if (status === 'running') {
    return <ActivityIndicator />
  }
  if (canExpand) {
    return <ChevronIcon isExpanded={isExpanded} />
  }
  if (status === 'completed') {
    return <CheckIcon />
  }
  if (status === 'error') {
    return <ErrorIcon />
  }
  return <CheckIcon />
}

export function ToolUseBlock({ tool }: ToolUseBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { action, detail, fullPath } = getToolDisplayInfo(tool)

  const hasResult = tool.result && tool.result.length > 0
  const hasInput = Object.keys(tool.input).length > 0
  const canExpand = hasResult || hasInput

  return (
    <div className="py-0.5">
      {/* Header */}
      <button
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-1.5 transition-colors duration-150 text-left ${
          canExpand ? 'hover:bg-white/[0.02] cursor-pointer' : 'cursor-default'
        }`}
        disabled={!canExpand}
      >
        {/* Status/expand indicator */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          <StatusIcon status={tool.status} canExpand={canExpand} isExpanded={isExpanded} />
        </div>

        {/* Action label */}
        <span className="text-sm font-light text-white/50 shrink-0">
          {action}
        </span>

        {/* Detail */}
        <code className="text-sm font-mono text-white/70 truncate">
          {detail}
        </code>

        {/* Full path tooltip on hover */}
        {fullPath && fullPath !== detail && (
          <span className="text-xs font-light text-white/20 truncate max-w-[200px] hidden group-hover:block">
            {fullPath}
          </span>
        )}

        <div className="flex-1" />

        {/* Running indicator */}
        {tool.status === 'running' && (
          <span className="text-xs font-light text-blue-400/70">running</span>
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (hasResult || hasInput) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: smoothEase }}
            className="overflow-hidden"
          >
            <div className="pl-6 py-2 space-y-3">
              {/* Input */}
              {hasInput && (
                <div>
                  <span className="text-[10px] font-light text-white/30 uppercase tracking-wider">
                    Input
                  </span>
                  <pre className="mt-1 text-xs font-mono text-white/40 overflow-x-auto max-h-24 overflow-y-auto leading-relaxed">
                    {JSON.stringify(tool.input, null, 2)}
                  </pre>
                </div>
              )}

              {/* Result */}
              {hasResult && (
                <div>
                  <span className="text-[10px] font-light text-white/30 uppercase tracking-wider">
                    Output
                  </span>
                  <pre className="mt-1 text-xs font-mono text-white/40 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {tool.result!.length > 1500
                      ? tool.result!.slice(0, 1500) + '\n... truncated'
                      : tool.result}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
