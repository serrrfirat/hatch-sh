import { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertCircle, RefreshCw, X, Rocket, FolderGit2 } from 'lucide-react'
import { useIdeaMazeStore, flushPendingSave, hasUnsavedChanges } from '../stores/ideaMazeStore'
import { useRepositoryStore } from '../stores/repositoryStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useChatStore } from '../stores/chatStore'
import { AtmosphericBackground } from '../components/ideaMaze/AtmosphericBackground'
import { VerticalToolbar } from '../components/ideaMaze/VerticalToolbar'
import { IdeaMazeCanvas } from '../components/ideaMaze/IdeaMazeCanvas'
import { IdeaMazeSidebar } from '../components/ideaMaze/IdeaMazeSidebar'
import { SaveIndicator } from '../components/ideaMaze/SaveIndicator'
import { sidebarVariants, COLORS } from '../lib/ideaMaze/animations'
import type { PlanContent } from '../lib/ideaMaze/types'

export function IdeaMazePage() {
  const {
    currentMoodboard,
    viewport,
    isSidebarOpen,
    isStorageInitialized,
    isLoading,
    storageError,
    initializeStore,
    createNewMoodboard,
    setToolMode,
    selectAll,
    clearSelection,
    deleteSelection,
    duplicateSelection,
    addNode,
    undo,
    redo,
  } = useIdeaMazeStore()

  const { repositories, createWorkspace, setCurrentWorkspace } = useRepositoryStore()
  const { setCurrentPage } = useSettingsStore()
  const { addMessage: addChatMessage } = useChatStore()

  // Build from Plan modal state
  const [buildModalOpen, setBuildModalOpen] = useState(false)
  const [buildPlanContent, setBuildPlanContent] = useState<PlanContent | null>(null)
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null)
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)

  // Handle Build This button click
  const handleBuildPlan = useCallback(
    (planContent: PlanContent) => {
      setBuildPlanContent(planContent)
      setBuildModalOpen(true)
      // Pre-select first repo if available
      if (repositories.length > 0 && !selectedRepoId) {
        setSelectedRepoId(repositories[0].id)
      }
    },
    [repositories, selectedRepoId]
  )

  // Create workspace from plan
  const handleCreateWorkspace = useCallback(async () => {
    if (!selectedRepoId || !buildPlanContent) return

    setIsCreatingWorkspace(true)
    try {
      // Create the workspace
      const workspace = await createWorkspace(selectedRepoId)

      // Build initial message from plan
      let initialMessage = `## Project Plan\n\n`
      initialMessage += `**Summary:** ${buildPlanContent.summary}\n\n`
      initialMessage += `**Requirements:**\n`
      buildPlanContent.requirements.forEach((req, idx) => {
        initialMessage += `${idx + 1}. ${req}\n`
      })
      if (buildPlanContent.designNotes) {
        initialMessage += `\n**Design Notes:** ${buildPlanContent.designNotes}\n`
      }
      if (buildPlanContent.technicalApproach) {
        initialMessage += `\n**Technical Approach:** ${buildPlanContent.technicalApproach}\n`
      }
      initialMessage += `\n---\n\nPlease help me build this. What's the best approach to get started?`

      // Add the initial message to the workspace chat
      // Note: The chat store keys messages by workspace ID
      addChatMessage({
        role: 'user',
        content: initialMessage,
      })

      // Set the new workspace as current
      setCurrentWorkspace(workspace)

      // Navigate to Build tab
      setCurrentPage('byoa')

      // Close modal
      setBuildModalOpen(false)
      setBuildPlanContent(null)
    } catch {
      // intentionally empty
    } finally {
      setIsCreatingWorkspace(false)
    }
  }, [
    selectedRepoId,
    buildPlanContent,
    createWorkspace,
    setCurrentWorkspace,
    setCurrentPage,
    addChatMessage,
  ])

  // Initialize storage on mount
  useEffect(() => {
    if (!isStorageInitialized) {
      initializeStore()
    }
  }, [isStorageInitialized, initializeStore])

  // Flush pending saves on app close/visibility change
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        // Synchronously warn user and attempt to save
        e.preventDefault()
        e.returnValue = ''
        // Flush save - this may not complete if user closes immediately
        flushPendingSave()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Flush save when tab/window loses focus
        flushPendingSave()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Flush any pending saves when component unmounts
      flushPendingSave()
    }
  }, [])

  // Create default moodboard if none exists after storage is initialized
  useEffect(() => {
    if (isStorageInitialized && !isLoading && !currentMoodboard) {
      createNewMoodboard('My Ideas')
    }
  }, [isStorageInitialized, isLoading, currentMoodboard, createNewMoodboard])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const isMeta = e.metaKey || e.ctrlKey

      switch (e.key.toLowerCase()) {
        case 'n':
          if (!isMeta) {
            // N - New node at center (handled in canvas)
            e.preventDefault()
          }
          break
        case 'c':
          if (!isMeta) {
            // C - Toggle connect mode
            e.preventDefault()
            setToolMode('connect')
          }
          break
        case 'v':
          if (!isMeta) {
            // V - Select mode
            e.preventDefault()
            setToolMode('select')
          }
          break
        case 'h':
          if (!isMeta) {
            // H - Pan mode
            e.preventDefault()
            setToolMode('pan')
          }
          break
        case 'a':
          if (isMeta) {
            // Cmd+A - Select all
            e.preventDefault()
            selectAll()
          }
          break
        case 'z':
          if (isMeta) {
            e.preventDefault()
            if (e.shiftKey) {
              redo()
            } else {
              undo()
            }
          }
          break
        case 'd':
          if (isMeta) {
            // Cmd+D - Duplicate
            e.preventDefault()
            duplicateSelection()
          }
          break
        case 'delete':
        case 'backspace':
          // Delete - Delete selection
          e.preventDefault()
          deleteSelection()
          break
        case 'escape':
          // Escape - Clear selection
          e.preventDefault()
          clearSelection()
          setToolMode('select')
          break
      }
    },
    [setToolMode, selectAll, clearSelection, deleteSelection, duplicateSelection, undo, redo]
  )

  // Handle paste - create new node with pasted content
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Don't create node if no moodboard is selected
      if (!currentMoodboard) return

      const text = e.clipboardData?.getData('text')
      if (!text?.trim()) return

      e.preventDefault()

      // Calculate center of viewport for new node position
      const centerX = -viewport.x / viewport.zoom + 400
      const centerY = -viewport.y / viewport.zoom + 300

      // Create node with pasted text
      addNode({ x: centerX, y: centerY }, [
        { type: 'text', id: crypto.randomUUID(), text: text.trim() },
      ])
    },
    [currentMoodboard, viewport, addNode]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('paste', handlePaste)
    }
  }, [handleKeyDown, handlePaste])

  // Loading state
  if (isLoading) {
    return (
      <div
        className="h-full w-full flex items-center justify-center"
        style={{ backgroundColor: COLORS.background }}
      >
        <div className="text-center">
          <Loader2
            className="w-8 h-8 animate-spin mx-auto mb-4"
            style={{ color: COLORS.primary }}
          />
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            Loading Idea Maze...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (storageError) {
    return (
      <div
        className="h-full w-full flex items-center justify-center"
        style={{ backgroundColor: COLORS.background }}
      >
        <div className="text-center max-w-md p-6">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold mb-2" style={{ color: COLORS.text }}>
            Failed to Load
          </h2>
          <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>
            {storageError}
          </p>
          <button
            onClick={() => initializeStore()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg mx-auto transition-colors hover:opacity-90"
            style={{ backgroundColor: COLORS.primary, color: COLORS.text }}
          >
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex relative overflow-hidden">
      {/* Dot Grid Background */}
      <AtmosphericBackground zoom={viewport.zoom} offsetX={viewport.x} offsetY={viewport.y} />

      {/* Left: Vertical Toolbar */}
      <VerticalToolbar />

      {/* Center: Canvas */}
      <div className="flex-1 relative">
        <IdeaMazeCanvas onBuildPlan={handleBuildPlan} />
        <div className="absolute top-4 right-4 z-20">
          <SaveIndicator />
        </div>
      </div>

      {/* Right: AI Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div
            key="sidebar"
            variants={sidebarVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="h-full bg-neutral-900/80 backdrop-blur-xl border-l border-white/10 overflow-hidden"
          >
            <IdeaMazeSidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Build from Plan Modal */}
      <AnimatePresence>
        {buildModalOpen && buildPlanContent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setBuildModalOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
            >
              <div
                className="rounded-xl shadow-2xl overflow-hidden"
                style={{
                  backgroundColor: COLORS.backgroundAlt,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: `1px solid ${COLORS.border}` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
                    >
                      <Rocket size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold" style={{ color: COLORS.text }}>
                        Build from Plan
                      </h3>
                      <p className="text-xs" style={{ color: COLORS.textMuted }}>
                        Create a workspace to start building
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setBuildModalOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    style={{ color: COLORS.textMuted }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  {/* Plan summary */}
                  <div
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    <p className="text-sm" style={{ color: COLORS.text }}>
                      {buildPlanContent.summary}
                    </p>
                    <p className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
                      {buildPlanContent.requirements.length} requirements
                    </p>
                  </div>

                  {/* Repository selector */}
                  <div>
                    <label
                      className="block text-xs uppercase tracking-wider mb-2"
                      style={{ color: COLORS.textMuted }}
                    >
                      Select Repository
                    </label>
                    {repositories.length === 0 ? (
                      <div
                        className="p-4 rounded-lg text-center"
                        style={{
                          backgroundColor: 'rgba(251, 191, 36, 0.1)',
                          border: '1px solid rgba(251, 191, 36, 0.3)',
                        }}
                      >
                        <FolderGit2 size={24} className="text-amber-400 mx-auto mb-2" />
                        <p className="text-sm text-amber-400">No repositories found</p>
                        <p className="text-xs" style={{ color: COLORS.textMuted }}>
                          Clone a repository in the Build tab first
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {repositories.map((repo) => (
                          <button
                            key={repo.id}
                            onClick={() => setSelectedRepoId(repo.id)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors"
                            style={{
                              backgroundColor:
                                selectedRepoId === repo.id
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : `${COLORS.surface}80`,
                              border:
                                selectedRepoId === repo.id
                                  ? '1px solid rgba(16, 185, 129, 0.4)'
                                  : `1px solid ${COLORS.border}30`,
                            }}
                          >
                            <FolderGit2
                              size={18}
                              style={{
                                color: selectedRepoId === repo.id ? '#10b981' : COLORS.textMuted,
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium truncate"
                                style={{
                                  color: selectedRepoId === repo.id ? '#10b981' : COLORS.text,
                                }}
                              >
                                {repo.name}
                              </p>
                              <p className="text-xs truncate" style={{ color: COLORS.textMuted }}>
                                {repo.full_name}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div
                  className="flex justify-end gap-3 px-5 py-4"
                  style={{
                    borderTop: `1px solid ${COLORS.border}`,
                    backgroundColor: `${COLORS.surface}40`,
                  }}
                >
                  <button
                    onClick={() => setBuildModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
                    style={{ color: COLORS.textMuted }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateWorkspace}
                    disabled={!selectedRepoId || isCreatingWorkspace}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.9)',
                      color: 'white',
                    }}
                  >
                    {isCreatingWorkspace ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Rocket size={14} />
                        <span>Create Workspace</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
