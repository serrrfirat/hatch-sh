import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Check,
  X,
  FolderOpen,
  Pencil,
} from 'lucide-react'
import { useIdeaMazeStore } from '../../stores/ideaMazeStore'
import { COLORS } from '../../lib/ideaMaze/animations'

export function MoodboardSelector() {
  const {
    moodboards,
    currentMoodboard,
    loadMoodboard,
    createNewMoodboard,
    deleteMoodboard,
    updateMoodboardName,
  } = useIdeaMazeStore()

  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isRenaming, setIsRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setDeleteConfirm(null)
        setIsCreating(false)
        setIsRenaming(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input when creating/renaming
  useEffect(() => {
    if ((isCreating || isRenaming) && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isCreating, isRenaming])

  const handleCreate = () => {
    if (newName.trim()) {
      createNewMoodboard(newName.trim())
      setNewName('')
      setIsCreating(false)
      setIsOpen(false)
    }
  }

  const handleRename = (id: string) => {
    if (newName.trim()) {
      updateMoodboardName(id, newName.trim())
      setNewName('')
      setIsRenaming(null)
    }
  }

  const handleSelect = (id: string) => {
    loadMoodboard(id)
    setIsOpen(false)
  }

  const handleDelete = (id: string) => {
    deleteMoodboard(id)
    setDeleteConfirm(null)
    // If we deleted the current moodboard, select another one
    if (currentMoodboard?.id === id) {
      const remaining = moodboards.filter(m => m.id !== id)
      if (remaining.length > 0) {
        loadMoodboard(remaining[0].id)
      }
    }
  }

  const startRenaming = (moodboard: { id: string; name: string }) => {
    setNewName(moodboard.name)
    setIsRenaming(moodboard.id)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Compact icon button trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors group hover:bg-white/5"
        style={{ color: isOpen ? COLORS.primary : COLORS.textMuted }}
        title={currentMoodboard?.name || 'Select moodboard'}
      >
        <FolderOpen size={18} />

        {/* Badge showing count */}
        {moodboards.length > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[9px] font-bold"
            style={{ backgroundColor: COLORS.primary, color: COLORS.background }}
          >
            {moodboards.length}
          </span>
        )}

        {/* Tooltip */}
        <div
          className="absolute left-full ml-2 px-2 py-1 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
          style={{ backgroundColor: COLORS.surface }}
        >
          {currentMoodboard?.name || 'Moodboards'}
        </div>
      </button>

      {/* Dropdown menu - opens to the right */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full top-0 ml-2 w-64 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{
              backgroundColor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/10">
              <h3 className="text-xs font-semibold text-white">Moodboards</h3>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                {currentMoodboard ? `Current: ${currentMoodboard.name}` : 'No moodboard selected'}
              </p>
            </div>

            {/* Moodboard list */}
            <div className="max-h-64 overflow-y-auto py-1">
              {moodboards.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <FolderOpen size={24} className="mx-auto mb-2 text-neutral-600" />
                  <p className="text-xs text-neutral-500">No moodboards yet</p>
                  <p className="text-[10px] text-neutral-600 mt-1">Create one to get started</p>
                </div>
              ) : (
                moodboards.map((moodboard) => (
                  <div
                    key={moodboard.id}
                    className={`group flex items-center justify-between px-3 py-2 hover:bg-white/5 cursor-pointer ${
                      currentMoodboard?.id === moodboard.id ? 'bg-white/10' : ''
                    }`}
                  >
                    {isRenaming === moodboard.id ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          ref={inputRef}
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(moodboard.id)
                            if (e.key === 'Escape') {
                              setIsRenaming(null)
                              setNewName('')
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs rounded bg-neutral-800 border border-white/20 text-white focus:outline-none focus:border-amber-500/50"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRename(moodboard.id)
                          }}
                          className="p-1 rounded hover:bg-white/10 text-green-400"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsRenaming(null)
                            setNewName('')
                          }}
                          className="p-1 rounded hover:bg-white/10 text-neutral-400"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="flex-1 min-w-0 flex items-center gap-2"
                          onClick={() => handleSelect(moodboard.id)}
                        >
                          <FolderOpen
                            size={14}
                            className={currentMoodboard?.id === moodboard.id ? 'text-amber-400' : 'text-neutral-500'}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                              {moodboard.name}
                            </div>
                            <div className="text-[10px] text-neutral-500">
                              {moodboard.nodes.length} ideas • {new Date(moodboard.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {deleteConfirm === moodboard.id ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(moodboard.id)
                                }}
                                className="p-1 rounded hover:bg-red-500/20 text-red-400"
                                title="Confirm delete"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirm(null)
                                }}
                                className="p-1 rounded hover:bg-white/10 text-neutral-400"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startRenaming(moodboard)
                                }}
                                className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white"
                                title="Rename"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirm(moodboard.id)
                                }}
                                className="p-1 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Create new section */}
            <div className="border-t border-white/10 py-1">
              {isCreating ? (
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={!isRenaming ? inputRef : undefined}
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreate()
                        if (e.key === 'Escape') {
                          setIsCreating(false)
                          setNewName('')
                        }
                      }}
                      className="flex-1 px-2 py-1 text-xs rounded bg-neutral-800 border border-white/20 text-white focus:outline-none focus:border-amber-500/50"
                      placeholder="New moodboard name"
                    />
                    <button
                      onClick={handleCreate}
                      className="p-1 rounded hover:bg-white/10 text-green-400"
                      title="Create"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false)
                        setNewName('')
                      }}
                      className="p-1 rounded hover:bg-white/10 text-neutral-400"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsCreating(true)
                    setNewName('')
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5"
                  style={{ color: COLORS.primary }}
                >
                  <Plus size={14} />
                  <span>Create new moodboard</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
