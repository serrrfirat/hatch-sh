import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch,
  Plus,
  MoreHorizontal,
  ChevronRight,
  Settings,
  FolderPlus,
  Github,
  Trash2,
  Archive,
  Loader2,
} from 'lucide-react'
import { useRepositoryStore, type Workspace } from '../../stores/repositoryStore'
import type { Repository } from '../../lib/git/bridge'
import { AddRepositoryMenu } from '../repository/AddRepositoryMenu'
import { ArchiveWorkspaceModal } from '../repository/ArchiveWorkspaceModal'
import { cn } from '@hatch/ui'

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

interface WorkspaceItemProps {
  workspace: Workspace
  index: number
  isActive: boolean
  onSelect: () => void
  onArchive: (position: { x: number; y: number }) => void
}

function WorkspaceItem({ workspace, index, isActive, onSelect, onArchive }: WorkspaceItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const workspaceLabel = workspace.branchName?.trim() || `workspace/${workspace.id}`

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ delay: index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'w-full flex items-start gap-2 px-3 py-2 ml-2 rounded-lg text-left transition-colors group',
        'hover:bg-white/5',
        isActive && 'bg-white/10'
      )}
    >
      {/* Clickable area */}
      <button onClick={onSelect} className="flex items-start gap-2 flex-1 min-w-0">
        {/* Branch icon or status indicator */}
        <div className="flex-shrink-0 mt-0.5">
          {workspace.isInitializing ? (
            <div className="w-4 h-4 flex items-center justify-center">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
            </div>
          ) : workspace.status === 'working' ? (
            <div className="w-4 h-4 flex items-center justify-center">
              <motion.div
                className="w-2 h-2 rounded-full bg-emerald-400"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </div>
          ) : workspace.status === 'error' ? (
            <div className="w-4 h-4 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-red-400" />
            </div>
          ) : (
            <GitBranch size={16} className="text-neutral-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white truncate">{workspaceLabel}</span>
            {/* Git stats */}
            {(workspace.additions !== undefined || workspace.deletions !== undefined) && (
              <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                {workspace.additions !== undefined && (
                  <span className="text-emerald-400">+{workspace.additions}</span>
                )}
                {workspace.additions !== undefined && workspace.deletions !== undefined && ' '}
                {workspace.deletions !== undefined && (
                  <span className="text-red-400">-{workspace.deletions}</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            {workspace.isInitializing ? (
              // Show initializing status
              <span className="text-emerald-400">Initializing...</span>
            ) : workspace.prNumber ? (
              // Show PR status
              <span className="flex items-center gap-1">
                <span className="text-emerald-400">PR #{workspace.prNumber}</span>
                <span>•</span>
                <span
                  className={
                    workspace.prState === 'merged' ? 'text-purple-400' : 'text-emerald-400'
                  }
                >
                  {workspace.prState === 'merged' ? 'Archive' : 'Ready to Merge'}
                </span>
              </span>
            ) : (
              // No PR - show status or time
              <span>
                {workspace.status === 'working'
                  ? 'Working...'
                  : formatTimeAgo(workspace.lastActive)}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Archive button (shown on hover) or keyboard shortcut */}
      <div className="flex-shrink-0 flex items-center">
        {isHovered ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              onArchive({ x: rect.left, y: rect.bottom })
            }}
            className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-amber-400 transition-colors"
            title="Archive workspace"
          >
            <Archive size={14} />
          </button>
        ) : (
          <span className="text-xs text-neutral-600 font-mono">⌘{index + 1}</span>
        )}
      </div>
    </motion.div>
  )
}

interface RepositoryItemProps {
  repository: Repository
  workspaces: Workspace[]
  globalWorkspaceIndex: number
  onSelectWorkspace: (workspace: Workspace) => void
  onNewWorkspace: (repositoryId: string) => void
  onRemoveRepository: (repositoryId: string) => void
  onArchiveWorkspace: (workspace: Workspace, position: { x: number; y: number }) => void
  currentWorkspaceId?: string
  isExpanded: boolean
  onToggleExpanded: () => void
}

function RepositoryItem({
  repository,
  workspaces,
  globalWorkspaceIndex,
  onSelectWorkspace,
  onNewWorkspace,
  onRemoveRepository,
  onArchiveWorkspace,
  currentWorkspaceId,
  isExpanded,
  onToggleExpanded,
}: RepositoryItemProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="border-b border-white/5 last:border-b-0">
      {/* Repository Header */}
      <div className="flex items-center justify-between px-3 py-3 hover:bg-white/5 transition-colors">
        <button onClick={onToggleExpanded} className="flex items-center gap-2 flex-1 text-left">
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight size={14} className="text-neutral-500" />
          </motion.div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white truncate">{repository.name}</span>
            {repository.full_name && repository.full_name !== repository.name && (
              <span className="text-xs text-neutral-500 truncate">{repository.full_name}</span>
            )}
          </div>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-44 bg-neutral-900 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden"
                >
                  <button
                    onClick={() => {
                      onNewWorkspace(repository.id)
                      setShowMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                  >
                    <Plus size={14} />
                    New workspace
                  </button>
                  {repository.clone_url && (
                    <a
                      href={repository.clone_url
                        .replace(/\.git$/, '')
                        .replace(/^git@github.com:/, 'https://github.com/')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                    >
                      <Github size={14} />
                      View on GitHub
                    </a>
                  )}
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                  >
                    <Settings size={14} />
                    Settings
                  </button>
                  <div className="border-t border-white/10" />
                  <button
                    onClick={() => {
                      onRemoveRepository(repository.id)
                      setShowMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Workspaces */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* New Workspace Button */}
            <button
              onClick={() => onNewWorkspace(repository.id)}
              className="w-full flex items-center gap-2 px-3 py-2 ml-2 text-sm text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Plus size={14} />
              New workspace
            </button>

            {workspaces.length > 0 && (
              <div className="pb-2">
                {workspaces.map((workspace, idx) => (
                  <WorkspaceItem
                    key={workspace.id}
                    workspace={workspace}
                    index={globalWorkspaceIndex + idx}
                    isActive={currentWorkspaceId === workspace.id}
                    onSelect={() => onSelectWorkspace(workspace)}
                    onArchive={(position) => onArchiveWorkspace(workspace, position)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ProjectTree() {
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set())
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>()
  const [archiveModalOpen, setArchiveModalOpen] = useState(false)
  const [workspaceToArchive, setWorkspaceToArchive] = useState<Workspace | null>(null)
  const [archivePosition, setArchivePosition] = useState<{ x: number; y: number } | undefined>()

  const {
    repositories,
    workspaces,
    currentWorkspace,
    githubAuth,
    setCurrentWorkspace,
    createWorkspace,
    removeRepository,
    checkGitHubAuth,
  } = useRepositoryStore()

  // Check GitHub auth on mount
  useEffect(() => {
    checkGitHubAuth()
  }, [checkGitHubAuth])

  // Auto-expand repos that have workspaces
  useEffect(() => {
    const reposWithWorkspaces = new Set(
      repositories
        .filter((repo) => workspaces.some((w) => w.repositoryId === repo.id))
        .map((r) => r.id)
    )
    setExpandedRepos((prev) => new Set([...prev, ...reposWithWorkspaces]))
  }, [repositories, workspaces])

  const handleSelectWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace)
  }

  const handleNewWorkspace = async (repositoryId: string) => {
    try {
      const workspace = await createWorkspace(repositoryId)
      setCurrentWorkspace(workspace)
    } catch (error) {}
  }

  const handleToggleExpanded = (repoId: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev)
      if (next.has(repoId)) {
        next.delete(repoId)
      } else {
        next.add(repoId)
      }
      return next
    })
  }

  const handleOpenAddMenu = () => {
    if (addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect()
      setMenuPosition({ x: rect.left, y: rect.top })
    }
    setAddMenuOpen(true)
  }

  const handleArchiveWorkspace = (workspace: Workspace, position: { x: number; y: number }) => {
    setWorkspaceToArchive(workspace)
    setArchivePosition(position)
    setArchiveModalOpen(true)
  }

  const handleCloseArchiveModal = () => {
    setArchiveModalOpen(false)
    setWorkspaceToArchive(null)
    setArchivePosition(undefined)
  }

  // Calculate global workspace index for keyboard shortcuts
  let globalIndex = 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-neutral-400">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
          <span className="text-sm font-medium">Workspaces</span>
        </div>
        {githubAuth?.is_authenticated && githubAuth.user && (
          <div className="flex items-center gap-2">
            <img
              src={githubAuth.user.avatar_url}
              alt={githubAuth.user.login}
              className="w-5 h-5 rounded-full"
            />
          </div>
        )}
      </div>

      {/* Repositories List */}
      <div className="flex-1 overflow-y-auto">
        {repositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <FolderPlus size={20} className="text-neutral-500" />
            </div>
            <p className="text-sm text-neutral-500 mb-4">No repositories yet</p>
            <button
              onClick={handleOpenAddMenu}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 transition-colors"
            >
              <Plus size={14} />
              Add repository
            </button>
          </div>
        ) : (
          repositories.map((repository) => {
            const repoWorkspaces = workspaces.filter((w) => w.repositoryId === repository.id)
            const startIndex = globalIndex
            globalIndex += repoWorkspaces.length
            return (
              <RepositoryItem
                key={repository.id}
                repository={repository}
                workspaces={repoWorkspaces}
                globalWorkspaceIndex={startIndex}
                onSelectWorkspace={handleSelectWorkspace}
                onNewWorkspace={handleNewWorkspace}
                onRemoveRepository={removeRepository}
                onArchiveWorkspace={handleArchiveWorkspace}
                currentWorkspaceId={currentWorkspace?.id}
                isExpanded={expandedRepos.has(repository.id)}
                onToggleExpanded={() => handleToggleExpanded(repository.id)}
              />
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-3">
        <button
          ref={addButtonRef}
          onClick={handleOpenAddMenu}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <FolderPlus size={16} />
          Add repository
        </button>
      </div>

      {/* Add Repository Menu */}
      <AddRepositoryMenu
        isOpen={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        position={menuPosition}
      />

      {/* Archive Workspace Modal */}
      <ArchiveWorkspaceModal
        isOpen={archiveModalOpen}
        onClose={handleCloseArchiveModal}
        workspace={workspaceToArchive}
        position={archivePosition}
      />
    </div>
  )
}

export default ProjectTree
