import { memo, useCallback } from 'react'
import { Folder, FolderOpen, FileText, FileCode, ChevronRight, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@hatch/ui'
import { useFileTree } from '../../hooks/useFileTree'
import { getFileIconType } from './fileTreeUtils'
import type { FileEntry } from '../../lib/git/bridge'

interface FileTreeProps {
  workspacePath?: string
  onFileSelect: (filePath: string) => void
}

interface TreeNodeProps {
  node: FileEntry
  depth: number
  expandedPaths: Set<string>
  selectedPath: string | null
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}

const TreeNode = memo(function TreeNode({
  node,
  depth,
  expandedPaths,
  selectedPath,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path
  const iconType = node.is_directory ? null : getFileIconType(node.name)

  const handleClick = useCallback(() => {
    if (node.is_directory) {
      onToggle(node.path)
    } else {
      onSelect(node.path)
    }
  }, [node.is_directory, node.path, onToggle, onSelect])

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-1.5 py-1 px-2 text-left text-sm transition-colors rounded-sm',
          'hover:bg-white/5',
          isSelected && 'bg-white/10 text-white',
          !isSelected && 'text-zinc-400'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={node.path}
      >
        {node.is_directory && (
          <ChevronRight
            size={14}
            className={cn(
              'flex-shrink-0 transition-transform duration-150 text-zinc-500',
              isExpanded && 'rotate-90'
            )}
          />
        )}
        {node.is_directory ? (
          isExpanded ? (
            <FolderOpen size={15} className="flex-shrink-0 text-amber-400/80" />
          ) : (
            <Folder size={15} className="flex-shrink-0 text-amber-400/60" />
          )
        ) : iconType === 'code' ? (
          <FileCode size={15} className="flex-shrink-0 text-sky-400/70 ml-[18px]" />
        ) : (
          <FileText size={15} className="flex-shrink-0 text-zinc-500 ml-[18px]" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.is_directory && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  )
})

export function FileTree({ workspacePath, onFileSelect }: FileTreeProps) {
  const {
    tree,
    isLoading,
    error,
    expandedPaths,
    selectedPath,
    toggleExpanded,
    selectFile,
    refresh,
  } = useFileTree(workspacePath)

  const handleFileSelect = useCallback((filePath: string) => {
    selectFile(filePath)
    onFileSelect(filePath)
  }, [selectFile, onFileSelect])

  if (!workspacePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
        <p className="text-sm text-zinc-500">No workspace selected</p>
      </div>
    )
  }

  if (isLoading && tree.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <AlertCircle size={18} className="text-red-400" />
        <p className="text-sm text-zinc-500">{error}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
        <Folder size={20} className="text-zinc-600 mb-2" />
        <p className="text-sm text-zinc-500">No files</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Files</span>
        <button
          onClick={refresh}
          className={cn(
            'p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors',
            isLoading && 'animate-spin'
          )}
          title="Refresh file tree"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.map(node => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            expandedPaths={expandedPaths}
            selectedPath={selectedPath}
            onToggle={toggleExpanded}
            onSelect={handleFileSelect}
          />
        ))}
      </div>
    </div>
  )
}