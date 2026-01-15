import { motion } from 'framer-motion'
import { FileText, Terminal, Edit, Search, Folder, Loader2, Check, X } from 'lucide-react'
import type { ToolUse } from '../../stores/chatStore'

interface ToolUseBlockProps {
  tool: ToolUse
}

function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase()
  if (name.includes('read')) return FileText
  if (name.includes('write')) return Edit
  if (name.includes('bash') || name.includes('command')) return Terminal
  if (name.includes('search') || name.includes('grep') || name.includes('glob')) return Search
  if (name.includes('list') || name.includes('directory')) return Folder
  return FileText
}

function getToolDisplayInfo(tool: ToolUse): { action: string; detail: string } {
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
    }
  }

  // Edit tool
  if (name.includes('edit')) {
    const filePath = (input.file_path || input.path || '') as string
    const fileName = filePath.split('/').pop() || filePath
    return {
      action: 'Edit',
      detail: fileName,
    }
  }

  // Bash/Command tool
  if (name.includes('bash') || name.includes('command')) {
    const command = (input.command || '') as string
    const truncatedCmd = command.length > 50 ? command.slice(0, 50) + '...' : command
    return {
      action: 'Run',
      detail: truncatedCmd,
    }
  }

  // Search/Grep tool
  if (name.includes('grep') || name.includes('search')) {
    const pattern = (input.pattern || input.query || '') as string
    return {
      action: 'Search',
      detail: pattern,
    }
  }

  // Glob tool
  if (name.includes('glob')) {
    const pattern = (input.pattern || '') as string
    return {
      action: 'Find files',
      detail: pattern,
    }
  }

  // Default
  return {
    action: tool.name,
    detail: JSON.stringify(input).slice(0, 50),
  }
}

function StatusIcon({ status }: { status: ToolUse['status'] }) {
  if (status === 'running') {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-3 h-3 text-blue-400" />
      </motion.div>
    )
  }
  if (status === 'completed') {
    return <Check className="w-3 h-3 text-green-400" />
  }
  if (status === 'error') {
    return <X className="w-3 h-3 text-red-400" />
  }
  return null
}

export function ToolUseBlock({ tool }: ToolUseBlockProps) {
  const Icon = getToolIcon(tool.name)
  const { action, detail } = getToolDisplayInfo(tool)

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 py-1.5 text-sm"
    >
      <Icon className="w-4 h-4 text-white/40" />
      <span className="text-white/60">{action}</span>
      <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs text-white/80 font-mono">
        {detail}
      </code>
      <StatusIcon status={tool.status} />
    </motion.div>
  )
}
