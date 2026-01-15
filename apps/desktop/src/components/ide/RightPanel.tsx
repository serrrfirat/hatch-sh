import { useState, useEffect, useCallback } from 'react'
import { cn } from '@vibed/ui'
import { Search, Plus, ChevronRight, ChevronDown, Terminal as TerminalIcon, Coins, RefreshCw, Eye, EyeOff, FolderOpen } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { PreviewPanel } from '../preview/PreviewPanel'
import { TokenPanel } from '../token/TokenPanel'
import { useRepositoryStore } from '../../stores/repositoryStore'
import { useEditorStore } from '../../stores/editorStore'
import { getDiffStats, listDirectoryFiles, type FileChange, type FileEntry } from '../../lib/git/bridge'
import { FileIcon } from '../icons/FileIcon'

type TopTab = 'changes' | 'files' | 'checks' | 'preview'
type BottomTab = 'terminal' | 'token'

interface FileChangeItemProps {
  file: FileChange
  onClick: () => void
}

function FileChangeItem({ file, onClick }: FileChangeItemProps) {
  const fileName = file.path.split('/').pop() || file.path

  const statusColors = {
    modified: 'text-amber-400',
    added: 'text-emerald-400',
    deleted: 'text-red-400',
    renamed: 'text-blue-400',
    untracked: 'text-neutral-400',
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors text-left group"
    >
      <FileIcon filename={fileName} className="w-4 h-4 flex-shrink-0" />
      <span className={cn('flex-1 text-sm truncate', statusColors[file.status])} title={file.path}>
        {fileName}
      </span>
      <div className="flex items-center gap-1 text-xs">
        {file.additions > 0 && (
          <span className="text-emerald-400">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-400">-{file.deletions}</span>
        )}
      </div>
    </button>
  )
}

interface FileTreeItemProps {
  entry: FileEntry
  depth: number
  onToggle: (path: string) => void
  onFileClick: (path: string) => void
  expandedPaths: Set<string>
}

function FileTreeItem({ entry, depth, onToggle, onFileClick, expandedPaths }: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(entry.path)
  const hasChildren = entry.children && entry.children.length > 0

  const handleClick = () => {
    if (entry.is_directory) {
      onToggle(entry.path)
    } else {
      onFileClick(entry.path)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-1.5 px-3 py-1 hover:bg-white/5 transition-colors text-left group"
        style={{ paddingLeft: `${12 + depth * 12}px` }}
      >
        {entry.is_directory ? (
          <>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={12} className="text-neutral-500 flex-shrink-0" />
              ) : (
                <ChevronRight size={12} className="text-neutral-500 flex-shrink-0" />
              )
            ) : (
              <span className="w-3" />
            )}
            <FileIcon filename={entry.name} isDirectory isOpen={isExpanded} className="w-4 h-4 flex-shrink-0" />
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileIcon filename={entry.name} className="w-4 h-4 flex-shrink-0" />
          </>
        )}
        <span className="text-sm text-neutral-300 truncate">{entry.name}</span>
      </button>
      {entry.is_directory && isExpanded && entry.children && (
        <>
          {entry.children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              onToggle={onToggle}
              onFileClick={onFileClick}
              expandedPaths={expandedPaths}
            />
          ))}
        </>
      )}
    </>
  )
}

function ChangesPanel() {
  const { currentWorkspace } = useRepositoryStore()
  const { openDiff } = useEditorStore()
  const [changes, setChanges] = useState<FileChange[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleFileClick = useCallback((path: string) => {
    if (currentWorkspace?.localPath) {
      openDiff(path, currentWorkspace.localPath)
    }
  }, [currentWorkspace?.localPath, openDiff])

  const fetchChanges = useCallback(async () => {
    if (!currentWorkspace?.localPath) {
      setChanges([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const stats = await getDiffStats(currentWorkspace.localPath)
      setChanges(stats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get changes')
      setChanges([])
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.localPath])

  useEffect(() => {
    fetchChanges()
  }, [fetchChanges])

  const filteredChanges = searchQuery
    ? changes.filter((f) => f.path.toLowerCase().includes(searchQuery.toLowerCase()))
    : changes

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 text-sm px-4 text-center">
        <p>No workspace selected</p>
        <p className="text-xs mt-1">Select a workspace to see changes</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-white/10">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded pl-7 pr-3 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/20"
            />
          </div>
          <button
            onClick={fetchChanges}
            disabled={loading}
            className="p-1.5 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading && changes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            Loading...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400 text-sm px-4 text-center">
            {error}
          </div>
        ) : filteredChanges.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            {searchQuery ? 'No matching files' : 'No changes'}
          </div>
        ) : (
          filteredChanges.map((file, idx) => (
            <FileChangeItem
              key={`${file.path}-${idx}`}
              file={file}
              onClick={() => handleFileClick(file.path)}
            />
          ))
        )}
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-t border-white/10 text-xs text-neutral-500">
        {changes.length} files changed
      </div>
    </div>
  )
}

function FilesPanel() {
  const { currentWorkspace, openLocalRepository } = useRepositoryStore()
  const { openFile } = useEditorStore()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showHidden, setShowHidden] = useState(true) // Default to showing hidden files
  const [totalFileCount, setTotalFileCount] = useState(0)
  const [hiddenFileCount, setHiddenFileCount] = useState(0)

  const handleFileClick = useCallback((path: string) => {
    if (currentWorkspace?.localPath) {
      openFile(path, currentWorkspace.localPath)
    }
  }, [currentWorkspace?.localPath, openFile])

  // Count files recursively
  const countFiles = useCallback((entries: FileEntry[], countHidden = false): { total: number; hidden: number } => {
    let total = 0
    let hidden = 0
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        hidden++
      }
      total++
      if (entry.children) {
        const childCounts = countFiles(entry.children, countHidden)
        total += childCounts.total
        hidden += childCounts.hidden
      }
    }
    return { total, hidden }
  }, [])

  const fetchFiles = useCallback(async () => {
    if (!currentWorkspace?.localPath) {
      setFiles([])
      setTotalFileCount(0)
      setHiddenFileCount(0)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const entries = await listDirectoryFiles(currentWorkspace.localPath, 5, showHidden)
      setFiles(entries)
      // Count files for display
      const counts = countFiles(entries)
      setTotalFileCount(counts.total)
      setHiddenFileCount(counts.hidden)
      // Auto-expand first level
      const firstLevel = new Set(entries.filter((e) => e.is_directory).map((e) => e.path))
      setExpandedPaths(firstLevel)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to list files')
      setFiles([])
      setTotalFileCount(0)
      setHiddenFileCount(0)
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.localPath, showHidden, countFiles])

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select a folder with source files',
      })

      if (selected && typeof selected === 'string') {
        // Open the selected folder as a repository
        const repo = await openLocalRepository(selected)
        // Create a workspace for it automatically
        const workspaceId = crypto.randomUUID()
        const workspace = {
          id: workspaceId,
          repositoryId: repo.id,
          branchName: repo.default_branch,
          localPath: repo.local_path,
          status: 'idle' as const,
          lastActive: new Date(),
        }
        // Update the store
        useRepositoryStore.setState((state) => ({
          workspaces: [...state.workspaces, workspace],
          currentWorkspace: workspace,
        }))
      }
    } catch (e) {
      console.error('Failed to open folder:', e)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleToggle = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  // Flatten files for search
  const flattenFiles = (entries: FileEntry[]): FileEntry[] => {
    let result: FileEntry[] = []
    for (const entry of entries) {
      result.push(entry)
      if (entry.children) {
        result = result.concat(flattenFiles(entry.children))
      }
    }
    return result
  }

  const filteredFiles = searchQuery
    ? flattenFiles(files).filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : null

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 text-sm px-4 text-center">
        <p>No workspace selected</p>
        <p className="text-xs mt-1">Select a workspace to see files</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-white/10">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded pl-7 pr-3 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/20"
            />
          </div>
          <button
            onClick={() => setShowHidden(!showHidden)}
            className={cn(
              "p-1.5 rounded hover:bg-white/10 transition-colors",
              showHidden ? "text-white" : "text-neutral-500"
            )}
            title={showHidden ? "Hide hidden files" : "Show hidden files"}
          >
            {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            onClick={fetchFiles}
            disabled={loading}
            className="p-1.5 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        {loading && files.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            Loading...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400 text-sm px-4 text-center">
            {error}
          </div>
        ) : filteredFiles ? (
          // Flat search results
          filteredFiles.length === 0 ? (
            <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
              No matching files
            </div>
          ) : (
            filteredFiles.map((file) => (
              <button
                key={file.path}
                onClick={() => !file.is_directory && handleFileClick(file.path)}
                className="w-full flex items-center gap-1.5 px-3 py-1 hover:bg-white/5 transition-colors text-left group"
              >
                <FileIcon filename={file.name} isDirectory={file.is_directory} className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm text-neutral-300 truncate">{file.name}</span>
                <span className="text-xs text-neutral-600 truncate ml-auto">{file.path}</span>
              </button>
            ))
          )
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 text-sm px-4 text-center gap-3">
            <FolderOpen size={32} className="text-neutral-600" />
            <div>
              <p>No files found</p>
              {!showHidden && (
                <button
                  onClick={() => setShowHidden(true)}
                  className="text-xs mt-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Show hidden files
                </button>
              )}
            </div>
            <button
              onClick={handleOpenFolder}
              className="mt-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs text-white transition-colors"
            >
              Open Different Folder
            </button>
          </div>
        ) : totalFileCount > 0 && totalFileCount === hiddenFileCount ? (
          // Only hidden/config files in directory
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
              {files.map((entry) => (
                <FileTreeItem
                  key={entry.path}
                  entry={entry}
                  depth={0}
                  onToggle={handleToggle}
                  onFileClick={handleFileClick}
                  expandedPaths={expandedPaths}
                />
              ))}
            </div>
            <div className="px-3 py-3 border-t border-white/10 bg-amber-900/20">
              <p className="text-xs text-amber-400/80 mb-2">
                This directory only contains config/hidden files
              </p>
              <button
                onClick={handleOpenFolder}
                className="w-full px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs text-white transition-colors flex items-center justify-center gap-2"
              >
                <FolderOpen size={12} />
                Open Different Folder
              </button>
            </div>
          </div>
        ) : (
          // Tree view
          files.map((entry) => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              onToggle={handleToggle}
              onFileClick={handleFileClick}
              expandedPaths={expandedPaths}
            />
          ))
        )}
      </div>

      {/* Path info - only show if we have regular file tree */}
      {!(totalFileCount > 0 && totalFileCount === hiddenFileCount) && (
        <div className="px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2">
          <span className="text-xs text-neutral-500 truncate flex-1" title={currentWorkspace.localPath}>
            {currentWorkspace.localPath}
          </span>
          <button
            onClick={handleOpenFolder}
            className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors flex-shrink-0"
            title="Open different folder"
          >
            <FolderOpen size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

function TerminalPanel() {
  return (
    <div className="h-full bg-neutral-950 font-mono text-sm p-3">
      <div className="text-neutral-400">
        <span className="text-emerald-400">user</span>
        <span className="text-neutral-600">@</span>
        <span className="text-cyan-400">vibed</span>
        <span className="text-neutral-600">:</span>
        <span className="text-blue-400">~/project</span>
        <span className="text-neutral-400"> $ </span>
        <span className="animate-pulse">▋</span>
      </div>
    </div>
  )
}

export function RightPanel() {
  const [topTab, setTopTab] = useState<TopTab>('changes')
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal')
  const { currentWorkspace } = useRepositoryStore()

  const topTabs: { id: TopTab; label: string }[] = [
    { id: 'changes', label: 'Changes' },
    { id: 'files', label: 'All files' },
    { id: 'checks', label: 'Checks' },
    { id: 'preview', label: 'Preview' },
  ]

  const bottomTabs: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
    { id: 'terminal', label: 'Terminal', icon: <TerminalIcon size={14} /> },
    { id: 'token', label: 'Token', icon: <Coins size={14} /> },
  ]

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      {/* Top Section - 60% height */}
      <div className="flex-[6] flex flex-col min-h-0">
        {/* Top Tabs */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/10 bg-neutral-900 flex-shrink-0">
          {topTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTopTab(tab.id)}
              className={cn(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                topTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-500 hover:text-white hover:bg-white/5'
              )}
            >
              {tab.label}
            </button>
          ))}
          {currentWorkspace && (
            <span className="ml-auto text-xs text-neutral-600 truncate max-w-[120px]" title={currentWorkspace.branchName}>
              {currentWorkspace.branchName}
            </span>
          )}
        </div>

        {/* Top Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {topTab === 'changes' && <ChangesPanel />}
          {topTab === 'files' && <FilesPanel />}
          {topTab === 'checks' && (
            <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
              No checks configured
            </div>
          )}
          {topTab === 'preview' && <PreviewPanel />}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 flex-shrink-0" />

      {/* Bottom Section - 40% height */}
      <div className="flex-[4] flex flex-col min-h-0">
        {/* Bottom Tabs */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 bg-neutral-900 flex-shrink-0">
          <div className="flex items-center gap-1">
            {bottomTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setBottomTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors',
                  bottomTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-500 hover:text-white hover:bg-white/5'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <button className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
            <Plus size={14} />
          </button>
        </div>

        {/* Bottom Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {bottomTab === 'terminal' && <TerminalPanel />}
          {bottomTab === 'token' && <TokenPanel />}
        </div>
      </div>
    </div>
  )
}
