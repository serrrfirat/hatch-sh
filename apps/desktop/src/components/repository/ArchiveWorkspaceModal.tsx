import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Archive, AlertTriangle, Loader2, GitBranch, FileWarning } from 'lucide-react'
import { useRepositoryStore, type Workspace } from '../../stores/repositoryStore'
import type { GitStatus } from '../../lib/git/bridge'

interface ArchiveWorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  workspace: Workspace | null
  position?: { x: number; y: number }
}

export function ArchiveWorkspaceModal({ isOpen, onClose, workspace, position }: ArchiveWorkspaceModalProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { getGitStatus, removeWorkspace, updateWorkspaceWorkflowStatus } = useRepositoryStore()

  // Check git status when modal opens
  useEffect(() => {
    if (isOpen && workspace) {
      checkWorkspaceStatus()
    } else {
      setGitStatus(null)
      setError(null)
    }
  }, [isOpen, workspace?.id])

  const checkWorkspaceStatus = async () => {
    if (!workspace) return

    setIsChecking(true)
    setError(null)

    try {
      const status = await getGitStatus(workspace.id)
      setGitStatus(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check workspace status')
    } finally {
      setIsChecking(false)
    }
  }

  const hasUncommittedChanges = gitStatus && (
    gitStatus.staged.length > 0 ||
    gitStatus.modified.length > 0 ||
    gitStatus.untracked.length > 0
  )

  const isActivelyWorking = workspace?.status === 'working'

  const hasWarning = hasUncommittedChanges || isActivelyWorking

  const handleArchive = async () => {
    if (!workspace) return
    setIsArchiving(true)
    setError(null)
    try {
      // Set workspace status to 'done' before archiving
      updateWorkspaceWorkflowStatus(workspace.id, 'done')
      removeWorkspace(workspace.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive workspace')
    } finally {
      setIsArchiving(false)
    }
  }

  const handleClose = () => {
    if (!isArchiving) {
      onClose()
    }
  }

  const totalChanges = gitStatus
    ? gitStatus.staged.length + gitStatus.modified.length + gitStatus.untracked.length
    : 0

  return (
    <AnimatePresence>
      {isOpen && workspace && (
        <>
          {/* Backdrop - transparent click area */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
          />

          {/* Dropdown */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 w-72 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            style={position ? {
              left: Math.min(position.x, window.innerWidth - 300),
              top: position.y + 8
            } : {
              left: 16,
              top: 100
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                {hasWarning ? (
                  <AlertTriangle size={16} className="text-amber-400" />
                ) : (
                  <Archive size={16} className="text-neutral-400" />
                )}
                <span className="text-sm font-medium text-white">Archive Workspace</span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 truncate">{workspace.branchName}</p>
            </div>

            {/* Content */}
            <div className="p-4">
              {isChecking ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-neutral-400" />
                  <span className="ml-2 text-sm text-neutral-400">Checking...</span>
                </div>
              ) : (
                <>
                  {/* Warning Banner */}
                  {hasWarning && (
                    <div className="mb-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-amber-400">
                            Active Development Detected
                          </p>
                          <p className="text-xs text-amber-300/70 mt-0.5">
                            Uncommitted changes will be lost.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Branch info */}
                  <div className="flex items-center gap-2 p-2 bg-neutral-800/50 rounded-lg mb-3">
                    <GitBranch size={14} className="text-neutral-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white truncate">{workspace.branchName}</p>
                      <p className="text-[10px] text-neutral-500">Branch will remain on remote</p>
                    </div>
                  </div>

                  {/* Uncommitted Changes */}
                  {hasUncommittedChanges && gitStatus && (
                    <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg mb-3">
                      <FileWarning size={14} className="text-red-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-red-400">
                          {totalChanges} uncommitted {totalChanges === 1 ? 'change' : 'changes'}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-red-300/70 mt-0.5">
                          {gitStatus.staged.length > 0 && (
                            <span>{gitStatus.staged.length} staged</span>
                          )}
                          {gitStatus.modified.length > 0 && (
                            <span>{gitStatus.modified.length} modified</span>
                          )}
                          {gitStatus.untracked.length > 0 && (
                            <span>{gitStatus.untracked.length} new</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active Status */}
                  {isActivelyWorking && (
                    <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-3">
                      <motion.div
                        className="w-2 h-2 rounded-full bg-amber-400"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                      <p className="text-xs text-amber-400">Currently active</p>
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-xs text-neutral-500 mb-3">
                    {hasWarning
                      ? 'This action cannot be undone.'
                      : 'This will remove the workspace from your list.'}
                  </p>

                  {/* Error */}
                  {error && (
                    <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleClose}
                      disabled={isArchiving}
                      className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleArchive}
                      disabled={isArchiving}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        hasWarning
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-neutral-700 text-white hover:bg-neutral-600'
                      }`}
                    >
                      {isArchiving ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Archiving...
                        </>
                      ) : (
                        <>
                          <Archive size={12} />
                          {hasWarning ? 'Archive Anyway' : 'Archive'}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
