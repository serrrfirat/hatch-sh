import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ToolUse } from '../../stores/chatStore'

interface ToolUseBlockProps {
  tool: ToolUse
}

// Smooth easing for animations
const smoothEase = [0.4, 0, 0.2, 1] as const

/**
 * Compute unified diff using longest common subsequence algorithm
 * Returns interleaved diff lines with context
 */
function computeUnifiedDiff(oldStr: string, newStr: string): Array<{ type: 'delete' | 'add' | 'context'; content: string }> {
  const oldLines = oldStr ? oldStr.split('\n') : []
  const newLines = newStr ? newStr.split('\n') : []

  // LCS-based diff algorithm
  const m = oldLines.length
  const n = newLines.length

  // Build LCS table
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  const result: Array<{ type: 'delete' | 'add' | 'context'; content: string }> = []
  let i = m
  let j = n
  const tempResult: typeof result = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      tempResult.push({ type: 'context', content: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempResult.push({ type: 'add', content: newLines[j - 1] })
      j--
    } else if (i > 0) {
      tempResult.push({ type: 'delete', content: oldLines[i - 1] })
      i--
    }
  }

  // Reverse to get correct order
  return tempResult.reverse()
}

/**
 * Unified diff display component for Edit tool
 * Shows old_string and new_string interleaved with proper highlighting
 */
function DiffView({ oldString, newString }: { oldString: string; newString: string }) {
  const diffLines = computeUnifiedDiff(oldString, newString)

  // Compute line numbers for old and new sides
  let oldLineNum = 1
  let newLineNum = 1

  return (
    <div className="font-mono text-xs border border-white/10 rounded overflow-hidden max-h-80 overflow-y-auto">
      {diffLines.map((line, i) => {
        const isDelete = line.type === 'delete'
        const isAdd = line.type === 'add'
        const isContext = line.type === 'context'

        // Track line numbers
        const displayOldNum = isDelete || isContext ? oldLineNum : null
        const displayNewNum = isAdd || isContext ? newLineNum : null

        if (isDelete || isContext) oldLineNum++
        if (isAdd || isContext) newLineNum++

        return (
          <div
            key={i}
            className={`flex ${
              isDelete ? 'bg-red-500/10' : isAdd ? 'bg-green-500/10' : ''
            }`}
          >
            {/* Old line number */}
            <span
              className={`w-8 shrink-0 text-right pr-1 select-none border-r border-white/5 ${
                isDelete
                  ? 'text-red-400/40 bg-red-500/15'
                  : isContext
                  ? 'text-white/20 bg-white/[0.02]'
                  : 'text-white/10 bg-white/[0.01]'
              }`}
            >
              {displayOldNum || ''}
            </span>
            {/* New line number */}
            <span
              className={`w-8 shrink-0 text-right pr-1 select-none border-r border-white/5 ${
                isAdd
                  ? 'text-green-400/40 bg-green-500/15'
                  : isContext
                  ? 'text-white/20 bg-white/[0.02]'
                  : 'text-white/10 bg-white/[0.01]'
              }`}
            >
              {displayNewNum || ''}
            </span>
            {/* Diff marker */}
            <span
              className={`w-5 shrink-0 text-center select-none ${
                isDelete ? 'text-red-400' : isAdd ? 'text-green-400' : 'text-white/20'
              }`}
            >
              {isDelete ? '-' : isAdd ? '+' : ' '}
            </span>
            {/* Content */}
            <code
              className={`px-2 flex-1 ${
                isDelete ? 'text-red-300/80' : isAdd ? 'text-green-300/80' : 'text-white/60'
              }`}
            >
              {line.content || ' '}
            </code>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Terminal-style output for Bash commands
 */
function TerminalOutput({ command, output }: { command: string; output?: string }) {
  return (
    <div className="font-mono text-xs border border-white/10 rounded overflow-hidden bg-[#0d1117]">
      {/* Command line */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/10">
        <span className="text-green-400">$</span>
        <code className="text-white/80">{command}</code>
      </div>
      {/* Output */}
      {output && (
        <pre className="px-3 py-2 text-white/60 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
          {output.length > 2000 ? output.slice(0, 2000) + '\n... (truncated)' : output}
        </pre>
      )}
    </div>
  )
}

/**
 * Code view with line numbers
 */
function CodeView({ content, fileName }: { content: string; fileName?: string }) {
  const lines = content.split('\n')
  const maxLines = 50
  const truncated = lines.length > maxLines

  return (
    <div className="font-mono text-xs border border-white/10 rounded overflow-hidden">
      {/* File header */}
      {fileName && (
        <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 text-white/50">
          {fileName}
        </div>
      )}
      {/* Code with line numbers */}
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        {lines.slice(0, maxLines).map((line, i) => (
          <div key={i} className="flex hover:bg-white/[0.02]">
            <span className="w-10 shrink-0 text-right pr-3 text-white/20 select-none border-r border-white/5 bg-white/[0.02]">
              {i + 1}
            </span>
            <code className="px-3 text-white/60 flex-1">
              {line || ' '}
            </code>
          </div>
        ))}
        {truncated && (
          <div className="px-3 py-2 text-white/30 italic">
            ... {lines.length - maxLines} more lines
          </div>
        )}
      </div>
    </div>
  )
}

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

  // Detect tool types for specialized rendering
  const toolName = tool.name.toLowerCase()
  const isEditTool = toolName.includes('edit')
  const isBashTool = toolName.includes('bash') || toolName.includes('command')
  const isReadTool = toolName.includes('read')
  const isWriteTool = toolName.includes('write')

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
              {/* Edit tool - show diff view */}
              {isEditTool && (
                <DiffView
                  oldString={(tool.input as Record<string, unknown>).old_string as string || ''}
                  newString={(tool.input as Record<string, unknown>).new_string as string || ''}
                />
              )}

              {/* Bash tool - show terminal output */}
              {isBashTool && (
                <TerminalOutput
                  command={(tool.input as Record<string, unknown>).command as string || ''}
                  output={tool.result}
                />
              )}

              {/* Read tool - show code with line numbers */}
              {isReadTool && hasResult && (
                <CodeView
                  content={tool.result!}
                  fileName={fullPath}
                />
              )}

              {/* Write tool - show the content being written */}
              {isWriteTool && (
                <CodeView
                  content={(tool.input as Record<string, unknown>).content as string || ''}
                  fileName={fullPath}
                />
              )}

              {/* Other tools - show raw input/output */}
              {!isEditTool && !isBashTool && !isReadTool && !isWriteTool && (
                <>
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
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
