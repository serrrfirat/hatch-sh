/**
 * CritiqueIndicator - Editorial annotation mark for idea nodes
 *
 * Design: Elegant margin annotation aesthetic - like an editor's mark
 * Critical = bold red presence, Warning = amber, Info = subtle blue
 *
 * Critiques are stored forever - dismissed ones can be viewed via "Show resolved"
 * Uses a slide-in panel for better UX with canvas interaction
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import type { NodeCritique } from '../../../lib/ideaMaze/types'
import { useIdeaMazeStore } from '../../../stores/ideaMazeStore'
import { SPRING_SMOOTH } from '../../../lib/ideaMaze/animations'

interface CritiqueIndicatorProps {
  nodeId: string
  critiques: NodeCritique[]
  nodeTitle?: string
}

// Severity colors - editorial palette
const SEVERITY_COLORS = {
  critical: {
    bg: 'rgba(220, 38, 38, 0.15)',
    border: 'rgba(220, 38, 38, 0.4)',
    text: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.3)',
    label: 'Critical',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.4)',
    text: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.3)',
    label: 'Warning',
  },
  info: {
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.3)',
    text: '#60a5fa',
    glow: 'rgba(96, 165, 250, 0.2)',
    label: 'Info',
  },
}

// Icons
const CritiqueIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path
      d="M6 1L7 4L10 4.5L7.5 7L8 10L6 8.5L4 10L4.5 7L2 4.5L5 4L6 1Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M3 7L6 10L11 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M4 4L1.5 6.5L4 9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1.5 6.5H9.5C11 6.5 12 7.5 12 9V9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path
      d="M5 5L13 13M13 5L5 13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

const HistoryIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
  >
    <path
      d="M3 4.5L6 7.5L9 4.5"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export function CritiqueIndicator({ nodeId, critiques, nodeTitle }: CritiqueIndicatorProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const { dismissCritique, undismissCritique } = useIdeaMazeStore()
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPanelOpen) {
        setIsPanelOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPanelOpen])

  // Close panel when clicking outside
  useEffect(() => {
    if (!isPanelOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsPanelOpen(false)
      }
    }

    // Delay to avoid immediate close from the badge click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPanelOpen])

  // Separate active and dismissed critiques
  const activeCritiques = critiques.filter((c) => !c.dismissed)
  const dismissedCritiques = critiques.filter((c) => c.dismissed)
  const hasAnyCritiques = critiques.length > 0

  // Show indicator if there are any critiques (active or history)
  if (!hasAnyCritiques) return null

  // Determine highest severity for the indicator (only from active)
  const highestSeverity = activeCritiques.length > 0
    ? activeCritiques.reduce((highest, c) => {
        const severityOrder = { critical: 3, warning: 2, info: 1 }
        return severityOrder[c.severity] > severityOrder[highest] ? c.severity : highest
      }, 'info' as 'info' | 'warning' | 'critical')
    : 'info'

  // Use muted colors if only resolved critiques exist
  const hasActive = activeCritiques.length > 0
  const colors = hasActive ? SEVERITY_COLORS[highestSeverity] : {
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.15)',
    text: 'rgba(255, 255, 255, 0.5)',
    glow: 'transparent',
    label: 'Resolved',
  }

  // Which critiques to display in panel
  const displayedCritiques = showResolved
    ? [...activeCritiques, ...dismissedCritiques]
    : activeCritiques

  return (
    <>
      {/* Badge indicator on card */}
      <div className="absolute -right-2 top-4 z-50">
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setIsPanelOpen(true)
          }}
          className="relative flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer"
          style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.text,
          }}
          whileHover={{ scale: 1.05, x: 2 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={SPRING_SMOOTH}
        >
          {/* Pulse effect for critical (only when active) */}
          {hasActive && highestSeverity === 'critical' && (
            <motion.div
              className="absolute inset-0 rounded-lg"
              style={{ background: colors.glow }}
              animate={{ opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          <CritiqueIcon />
          <span className="text-[10px] font-semibold relative z-10">
            {hasActive ? activeCritiques.length : (
              <span className="flex items-center gap-0.5">
                <HistoryIcon />
                {dismissedCritiques.length}
              </span>
            )}
          </span>
        </motion.button>
      </div>

      {/* Slide-in panel rendered via Portal */}
      {createPortal(
        <AnimatePresence>
          {isPanelOpen && (
            <CritiquePanel
              ref={panelRef}
              nodeTitle={nodeTitle}
              activeCritiques={activeCritiques}
              dismissedCritiques={dismissedCritiques}
              displayedCritiques={displayedCritiques}
              showResolved={showResolved}
              setShowResolved={setShowResolved}
              onClose={() => setIsPanelOpen(false)}
              onDismiss={(critiqueId) => dismissCritique(nodeId, critiqueId)}
              onUndismiss={(critiqueId) => undismissCritique(nodeId, critiqueId)}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

interface CritiquePanelProps {
  nodeTitle?: string
  activeCritiques: NodeCritique[]
  dismissedCritiques: NodeCritique[]
  displayedCritiques: NodeCritique[]
  showResolved: boolean
  setShowResolved: (show: boolean) => void
  onClose: () => void
  onDismiss: (critiqueId: string) => void
  onUndismiss: (critiqueId: string) => void
}

const CritiquePanel = forwardRef<HTMLDivElement, CritiquePanelProps>(({
  nodeTitle,
  activeCritiques,
  dismissedCritiques,
  displayedCritiques,
  showResolved,
  setShowResolved,
  onClose,
  onDismiss,
  onUndismiss,
}, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ x: '100%', opacity: 0.8 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.8 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed top-0 right-0 h-full w-96 z-[9999] flex flex-col"
      style={{
        background: 'rgba(13, 13, 13, 0.98)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.5)',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white">Critiques</h2>
          {nodeTitle && (
            <p className="text-xs text-white/40 mt-0.5 truncate">
              {nodeTitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Stats */}
          <div className="flex items-center gap-2 text-[11px]">
            {activeCritiques.length > 0 && (
              <span className="text-white/60">
                {activeCritiques.length} active
              </span>
            )}
            {dismissedCritiques.length > 0 && (
              <span className="text-white/40">
                {dismissedCritiques.length} resolved
              </span>
            )}
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Critique list - scrollable */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ overscrollBehavior: 'contain' }}
      >
        {displayedCritiques.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <CritiqueIcon />
            </div>
            <p className="text-sm text-white/40">No active critiques</p>
            {dismissedCritiques.length > 0 && (
              <button
                onClick={() => setShowResolved(true)}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Show {dismissedCritiques.length} resolved critique{dismissedCritiques.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {displayedCritiques.map((critique) => (
              <CritiquePanelItem
                key={critique.id}
                critique={critique}
                onDismiss={() => onDismiss(critique.id)}
                onUndismiss={() => onUndismiss(critique.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with show resolved toggle */}
      {dismissedCritiques.length > 0 && (
        <div className="flex-shrink-0 px-5 py-3 border-t border-white/5 flex items-center justify-between">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`
              flex items-center gap-2 text-xs transition-colors
              ${showResolved ? 'text-white/70' : 'text-white/40 hover:text-white/60'}
            `}
          >
            <HistoryIcon />
            <span>{showResolved ? 'Hide' : 'Show'} resolved ({dismissedCritiques.length})</span>
          </button>
          <span className="text-[10px] text-white/30">
            Esc to close
          </span>
        </div>
      )}
    </motion.div>
  )
})

CritiquePanel.displayName = 'CritiquePanel'

interface CritiquePanelItemProps {
  critique: NodeCritique
  onDismiss: () => void
  onUndismiss: () => void
}

function CritiquePanelItem({ critique, onDismiss, onUndismiss }: CritiquePanelItemProps) {
  const [showSuggestions, setShowSuggestions] = useState(true) // Default expanded
  const colors = SEVERITY_COLORS[critique.severity]
  const isDismissed = critique.dismissed

  return (
    <div className={`px-5 py-5 ${isDismissed ? 'opacity-60' : ''}`}>
      {/* Header row: severity badge + action */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {/* Severity indicator bar */}
          <div
            className="w-1 h-5 rounded-full flex-shrink-0"
            style={{ background: isDismissed ? 'rgba(255,255,255,0.2)' : colors.text }}
          />
          {/* Severity label */}
          <span
            className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              background: isDismissed ? 'rgba(255,255,255,0.05)' : colors.bg,
              color: isDismissed ? 'rgba(255,255,255,0.4)' : colors.text,
            }}
          >
            {isDismissed ? 'Resolved' : colors.label}
          </span>
          {/* Timestamp */}
          {critique.createdAt && (
            <span className="text-[10px] text-white/30">
              {new Date(critique.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Action button */}
        {isDismissed ? (
          <button
            onClick={onUndismiss}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors text-xs"
            title="Restore critique"
          >
            <UndoIcon />
            <span>Restore</span>
          </button>
        ) : (
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/50 hover:text-emerald-400 transition-colors text-xs"
            title="Mark as resolved"
          >
            <CheckIcon />
            <span>Resolve</span>
          </button>
        )}
      </div>

      {/* Critique text */}
      <p className={`text-sm leading-relaxed ${isDismissed ? 'text-white/40 line-through' : 'text-white/90'}`}>
        {critique.critique}
      </p>

      {/* Suggestions */}
      {critique.suggestions.length > 0 && !isDismissed && (
        <div className="mt-4">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
            style={{ color: colors.text }}
          >
            <span>{critique.suggestions.length} suggestion{critique.suggestions.length > 1 ? 's' : ''}</span>
            <ChevronIcon expanded={showSuggestions} />
          </button>

          <AnimatePresence>
            {showSuggestions && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 space-y-2.5 overflow-hidden pl-3 border-l-2"
                style={{ borderColor: `${colors.text}30` }}
              >
                {critique.suggestions.map((suggestion, i) => (
                  <li
                    key={i}
                    className="text-xs text-white/60 leading-relaxed"
                  >
                    {suggestion}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
