import type { ToolUse } from '../../stores/chatStore'

interface FileChange {
  fileName: string
  fullPath: string
  additions: number
  deletions: number
  isNew: boolean
}

interface ChangedFilesPillsProps {
  toolUses: ToolUse[]
  maxVisible?: number
}

/**
 * Extract file changes from tool uses
 */
function extractFileChanges(toolUses: ToolUse[]): FileChange[] {
  const fileChangesMap = new Map<string, FileChange>()

  for (const tool of toolUses) {
    const name = tool.name.toLowerCase()
    const input = tool.input as Record<string, unknown>

    // Only process completed file modification tools
    if (tool.status !== 'completed') continue

    // Write tool - new file or complete overwrite
    if (name.includes('write')) {
      const filePath = (input.file_path || input.path || '') as string
      if (!filePath) continue

      const fileName = filePath.split('/').pop() || filePath
      const content = (input.content || '') as string
      const lines = content.split('\n').length

      const existing = fileChangesMap.get(filePath)
      if (existing) {
        // Accumulate changes to same file
        existing.additions += lines
        existing.isNew = false // If we had previous operations, it's not new
      } else {
        fileChangesMap.set(filePath, {
          fileName,
          fullPath: filePath,
          additions: lines,
          deletions: 0,
          isNew: true,
        })
      }
    }

    // Edit tool - partial modification
    if (name.includes('edit')) {
      const filePath = (input.file_path || input.path || '') as string
      if (!filePath) continue

      const fileName = filePath.split('/').pop() || filePath
      const oldString = (input.old_string || '') as string
      const newString = (input.new_string || '') as string

      const oldLines = oldString.split('\n').length
      const newLines = newString.split('\n').length

      const additions = Math.max(0, newLines - oldLines) + Math.min(oldLines, newLines)
      const deletions = oldLines

      const existing = fileChangesMap.get(filePath)
      if (existing) {
        existing.additions += additions
        existing.deletions += deletions
        existing.isNew = false
      } else {
        fileChangesMap.set(filePath, {
          fileName,
          fullPath: filePath,
          additions,
          deletions,
          isNew: false,
        })
      }
    }
  }

  return Array.from(fileChangesMap.values())
}

/**
 * Single file pill component
 */
function FilePill({ change }: { change: FileChange }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-900/40 border border-teal-700/30 text-xs"
      title={change.fullPath}
    >
      <span className="font-mono text-white/70 truncate max-w-[140px]">
        {change.fileName}
      </span>
      <span className="flex items-center gap-1">
        {change.additions > 0 && (
          <span className="text-green-400/90 font-light">+{change.additions}</span>
        )}
        {change.deletions > 0 && (
          <span className="text-orange-400/90 font-light">-{change.deletions}</span>
        )}
        {change.additions === 0 && change.deletions === 0 && change.isNew && (
          <span className="text-green-400/90 font-light">new</span>
        )}
      </span>
    </div>
  )
}

/**
 * Summary pill for when there are more files than can be shown
 */
function SummaryPill({
  hiddenCount,
  totalAdditions,
  totalDeletions
}: {
  hiddenCount: number
  totalAdditions: number
  totalDeletions: number
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs">
      <span className="text-white/50 font-light">+{hiddenCount} more</span>
      <span className="flex items-center gap-1">
        {totalAdditions > 0 && (
          <span className="text-green-400/70 font-light">+{totalAdditions}</span>
        )}
        {totalDeletions > 0 && (
          <span className="text-orange-400/70 font-light">-{totalDeletions}</span>
        )}
      </span>
    </div>
  )
}

/**
 * Displays colored pills for files that were modified by tool uses
 */
export function ChangedFilesPills({ toolUses, maxVisible = 4 }: ChangedFilesPillsProps) {
  const fileChanges = extractFileChanges(toolUses)

  if (fileChanges.length === 0) {
    return null
  }

  const visibleChanges = fileChanges.slice(0, maxVisible)
  const hiddenChanges = fileChanges.slice(maxVisible)

  const hiddenTotalAdditions = hiddenChanges.reduce((sum, f) => sum + f.additions, 0)
  const hiddenTotalDeletions = hiddenChanges.reduce((sum, f) => sum + f.deletions, 0)

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2 pl-6">
      {visibleChanges.map((change) => (
        <FilePill key={change.fullPath} change={change} />
      ))}
      {hiddenChanges.length > 0 && (
        <SummaryPill
          hiddenCount={hiddenChanges.length}
          totalAdditions={hiddenTotalAdditions}
          totalDeletions={hiddenTotalDeletions}
        />
      )}
    </div>
  )
}
