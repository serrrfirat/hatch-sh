import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useIdeaMazeStore, flushPendingSave, hasUnsavedChanges } from '../stores/ideaMazeStore'
import { AtmosphericBackground } from '../components/ideaMaze/AtmosphericBackground'
import { VerticalToolbar } from '../components/ideaMaze/VerticalToolbar'
import { IdeaMazeCanvas } from '../components/ideaMaze/IdeaMazeCanvas'
import { IdeaMazeSidebar } from '../components/ideaMaze/IdeaMazeSidebar'
import { sidebarVariants, COLORS } from '../lib/ideaMaze/animations'

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
  } = useIdeaMazeStore()

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
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
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
    [setToolMode, selectAll, clearSelection, deleteSelection, duplicateSelection]
  )

  // Handle paste - create new node with pasted content
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
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
      addNode(
        { x: centerX, y: centerY },
        [{ type: 'text', id: crypto.randomUUID(), text: text.trim() }]
      )
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
      <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: COLORS.background }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: COLORS.primary }} />
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Loading Idea Maze...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (storageError) {
    return (
      <div className="h-full w-full flex items-center justify-center" style={{ backgroundColor: COLORS.background }}>
        <div className="text-center max-w-md p-6">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold mb-2" style={{ color: COLORS.text }}>Failed to Load</h2>
          <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>{storageError}</p>
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
      <AtmosphericBackground
        zoom={viewport.zoom}
        offsetX={viewport.x}
        offsetY={viewport.y}
      />

      {/* Left: Vertical Toolbar */}
      <VerticalToolbar />

      {/* Center: Canvas */}
      <div className="flex-1 relative">
        <IdeaMazeCanvas />
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
    </div>
  )
}
