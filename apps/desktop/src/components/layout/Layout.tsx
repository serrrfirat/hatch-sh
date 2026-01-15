import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useRepositoryStore } from '../../stores/repositoryStore'
import { useSettingsStore, type AppPage } from '../../stores/settingsStore'
import { ProjectTree } from './ProjectTree'
import { SettingsPanel } from '../SettingsPanel'
import { DiscoverPage } from '../DiscoverPage'
import { GitBranch, GitPullRequest, ChevronDown, ChevronLeft, ChevronRight, Settings, Terminal, Compass, Loader2, ExternalLink, Archive, AlertCircle, X } from 'lucide-react'
import { CreatePRModal } from '../repository/CreatePRModal'

const pageTabs: { id: AppPage; label: string; icon: typeof Terminal }[] = [
  { id: 'byoa', label: 'BYOA', icon: Terminal },
  { id: 'discover', label: 'Discover', icon: Compass },
]

export function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [prModalOpen, setPrModalOpen] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const { currentWorkspace, currentRepository, mergePullRequest, removeWorkspace } = useRepositoryStore()
  const { claudeCodeStatus, currentPage, setCurrentPage } = useSettingsStore()

  const handleMergePR = async () => {
    if (!currentWorkspace?.prNumber) return
    setIsMerging(true)
    setMergeError(null)
    try {
      await mergePullRequest(currentWorkspace.id)
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Failed to merge PR')
    } finally {
      setIsMerging(false)
    }
  }

  const handleArchiveWorkspace = async () => {
    if (!currentWorkspace) return
    await removeWorkspace(currentWorkspace.id)
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white selection:bg-white selection:text-black">
      {/* Top Bar - Compact Header */}
      <header className="h-10 flex items-center justify-between px-3 bg-neutral-900 border-b border-white/10">
        {/* Left: Navigation arrows */}
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button className="p-1.5 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Center: Branch info */}
        <div className="flex items-center gap-2 text-sm">
          {currentWorkspace ? (
            <>
              <GitBranch size={14} className="text-neutral-500" />
              <span className="text-white font-medium">{currentWorkspace.branchName}</span>
              <ChevronRight size={12} className="text-neutral-600" />
              <button className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors">
                <span>origin/main</span>
                <ChevronDown size={12} />
              </button>
            </>
          ) : (
            <span className="text-neutral-500">No workspace selected</span>
          )}
        </div>

        {/* Right: Page tabs + Settings */}
        <div className="flex items-center gap-3">
          {/* Page tabs (BYOA / Discover) */}
          <div className="flex items-center bg-neutral-800/50 rounded-lg p-0.5">
            {pageTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentPage(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  currentPage === tab.id
                    ? 'text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {currentPage === tab.id && (
                  <motion.div
                    layoutId="activePageTab"
                    className="absolute inset-0 bg-neutral-700 rounded-md"
                    initial={false}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <tab.icon size={12} />
                  <span>{tab.label}</span>
                  {tab.id === 'byoa' && claudeCodeStatus?.installed && claudeCodeStatus?.authenticated && (
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Repository name */}
          {currentRepository && (
            <button className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-800 border border-white/10 text-xs text-neutral-300 hover:text-white hover:border-white/20 transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{currentRepository.name}</span>
              <ChevronDown size={10} />
            </button>
          )}

          {/* PR Controls */}
          {currentWorkspace && (
            <div className="flex items-center gap-2">
              {currentWorkspace.prNumber ? (
                // Has PR - show PR status and actions
                <>
                  {/* PR Badge */}
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-medium">
                    PR #{currentWorkspace.prNumber}
                  </span>

                  {/* Status Badge */}
                  {currentWorkspace.prState === 'merged' ? (
                    <span className="px-2 py-0.5 rounded bg-purple-600 text-white text-xs">
                      Merged
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs">
                      Ready to merge
                    </span>
                  )}

                  {/* Review Button */}
                  <button
                    onClick={() => currentWorkspace.prUrl && window.open(currentWorkspace.prUrl, '_blank')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/20 text-white text-xs hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink size={12} />
                    Review
                  </button>

                  {/* Action Button */}
                  {currentWorkspace.prState === 'merged' ? (
                    <button
                      onClick={handleArchiveWorkspace}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-700 text-white text-xs font-medium hover:bg-neutral-600 transition-colors"
                    >
                      <Archive size={14} />
                      Archive workspace
                    </button>
                  ) : (
                    <button
                      onClick={handleMergePR}
                      disabled={isMerging}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isMerging ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Merging...
                        </>
                      ) : (
                        <>
                          <GitPullRequest size={14} />
                          Merge
                        </>
                      )}
                    </button>
                  )}
                </>
              ) : (
                // No PR - show Create PR button
                <button
                  onClick={() => setPrModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 transition-colors"
                >
                  <GitPullRequest size={14} />
                  <span>Create PR</span>
                </button>
              )}
            </div>
          )}

          <div className="h-4 w-px bg-white/10" />

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {currentPage === 'byoa' ? (
          <>
            {/* Sidebar */}
            <aside className="w-72 border-r border-white/10 bg-neutral-900 flex flex-col">
              <ProjectTree />
            </aside>

            {/* Main area */}
            <div className="flex-1 bg-neutral-950 overflow-hidden">
              <Outlet />
            </div>
          </>
        ) : (
          /* Full-page Discover */
          <div className="flex-1 bg-neutral-950 overflow-hidden">
            <DiscoverPage />
          </div>
        )}
      </main>

      {/* Settings Panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Create PR Modal */}
      <CreatePRModal isOpen={prModalOpen} onClose={() => setPrModalOpen(false)} />

      {/* Merge Error Modal */}
      {mergeError && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle size={20} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1">Merge Failed</h3>
                <p className="text-sm text-neutral-400">{mergeError}</p>
              </div>
              <button
                onClick={() => setMergeError(null)}
                className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setMergeError(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
