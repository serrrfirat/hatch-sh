import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitPullRequest, X, Loader2, ExternalLink } from 'lucide-react'
import { useRepositoryStore } from '../../stores/repositoryStore'

interface CreatePRModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreatePRModal({ isOpen, onClose }: CreatePRModalProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prUrl, setPrUrl] = useState<string | null>(null)

  const { currentWorkspace, currentRepository, createPullRequest } = useRepositoryStore()

  const handleCreate = async () => {
    if (!currentWorkspace) {
      setError('No workspace selected')
      return
    }

    if (!title.trim()) {
      setError('Please enter a title')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      await createPullRequest(currentWorkspace.id, title.trim(), body.trim())
      // Close modal on success - header will now show PR controls
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PR')
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setTitle('')
    setBody('')
    setError(null)
    setPrUrl(null)
    onClose()
  }

  // Generate a suggested title from the workspace branch name
  const suggestedTitle = currentWorkspace?.branchName
    ?.replace('workspace/', '')
    ?.replace(/-/g, ' ')
    ?.replace(/^\w/, (c) => c.toUpperCase()) || ''

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <GitPullRequest size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Create Pull Request</h2>
                  {currentRepository && (
                    <p className="text-xs text-neutral-500">{currentRepository.full_name}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {prUrl ? (
                // Success state
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <GitPullRequest size={32} className="text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Pull Request Created!</h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    Your changes have been pushed and a PR has been opened.
                  </p>
                  <a
                    href={prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors"
                  >
                    <ExternalLink size={16} />
                    View on GitHub
                  </a>
                </div>
              ) : (
                // Form
                <>
                  {/* Branch info */}
                  <div className="mb-4 p-3 bg-neutral-800/50 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-neutral-400">Merging</span>
                      <code className="px-2 py-0.5 bg-neutral-700 rounded text-emerald-400 text-xs">
                        {currentWorkspace?.branchName || 'no branch'}
                      </code>
                      <span className="text-neutral-400">into</span>
                      <code className="px-2 py-0.5 bg-neutral-700 rounded text-blue-400 text-xs">
                        {currentRepository?.default_branch || 'main'}
                      </code>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={suggestedTitle || 'Add a descriptive title'}
                      className="w-full px-4 py-2.5 bg-neutral-800 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10"
                      autoFocus
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      Description <span className="text-neutral-500">(optional)</span>
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Describe the changes in this PR..."
                      rows={4}
                      className="w-full px-4 py-2.5 bg-neutral-800 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 resize-none"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={isCreating || !currentWorkspace}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <GitPullRequest size={16} />
                          Create PR
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
