/**
 * ConnectionLegend - Floating panel for connection visualization controls
 *
 * Design: Editorial floating panel, minimal yet information-rich.
 * Inspired by map legends and data visualization controls.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useIdeaMazeStore } from '../../../stores/ideaMazeStore'
import { COLORS, TRANSITION_FAST, SPRING_SMOOTH } from '../../../lib/ideaMaze/animations'
import type { ConnectionRelationship } from '../../../lib/ideaMaze/types'

// Icons
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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const FocusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 1V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7 11V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M1 7H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M11 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const SparkleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path
      d="M6 1L6.8 4.2L10 5L6.8 5.8L6 9L5.2 5.8L2 5L5.2 4.2L6 1Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
)

// Relationship metadata
interface RelationshipMeta {
  label: string
  color: string
  description: string
}

const RELATIONSHIPS: Record<ConnectionRelationship, RelationshipMeta> = {
  related: {
    label: 'Related',
    color: COLORS.connection.related,
    description: 'Semantically connected concepts',
  },
  'depends-on': {
    label: 'Depends',
    color: COLORS.connection['depends-on'],
    description: 'Causal or prerequisite relationship',
  },
  contradicts: {
    label: 'Contradicts',
    color: COLORS.connection.contradicts,
    description: 'Opposing or conflicting ideas',
  },
  extends: {
    label: 'Extends',
    color: COLORS.connection.extends,
    description: 'Builds upon or elaborates',
  },
  alternative: {
    label: 'Alternative',
    color: COLORS.connection.alternative,
    description: 'Different approach to same goal',
  },
}

interface FilterToggleProps {
  meta: RelationshipMeta
  enabled: boolean
  count: number
  onToggle: () => void
}

function FilterToggle({ meta, enabled, count, onToggle }: FilterToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`
        group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150
        ${enabled
          ? 'bg-white/5 hover:bg-white/10'
          : 'opacity-40 hover:opacity-60'
        }
      `}
      title={meta.description}
    >
      {/* Color indicator */}
      <span
        className="w-3 h-3 rounded-full transition-transform duration-150 group-hover:scale-110"
        style={{ backgroundColor: meta.color, opacity: enabled ? 1 : 0.3 }}
      />

      {/* Label */}
      <span className={`text-xs font-medium transition-colors ${enabled ? 'text-white' : 'text-neutral-500'}`}>
        {meta.label}
      </span>

      {/* Count badge */}
      {count > 0 && (
        <span className={`
          text-[10px] px-1.5 py-0.5 rounded-full
          ${enabled ? 'bg-white/10 text-neutral-300' : 'bg-white/5 text-neutral-500'}
        `}>
          {count}
        </span>
      )}
    </button>
  )
}

export function ConnectionLegend() {
  const [isExpanded, setIsExpanded] = useState(true)

  const {
    currentMoodboard,
    connectionFilters,
    focusMode,
    setConnectionFilter,
    toggleFocusMode,
    resetConnectionFilters,
  } = useIdeaMazeStore()

  const connections = currentMoodboard?.connections || []
  const totalConnections = connections.length

  // Count connections by type
  const counts: Record<ConnectionRelationship, number> = {
    related: 0,
    'depends-on': 0,
    contradicts: 0,
    extends: 0,
    alternative: 0,
  }

  let aiSuggestedCount = 0

  for (const conn of connections) {
    counts[conn.relationship]++
    if (conn.aiSuggested) aiSuggestedCount++
  }

  // Calculate how many are currently visible
  const visibleCount = connections.filter(c => {
    if (!connectionFilters[c.relationship]) return false
    if (c.aiSuggested && !connectionFilters.showAISuggested) return false
    return true
  }).length

  if (totalConnections === 0) {
    return null // Don't show legend if no connections
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SMOOTH}
      className="absolute bottom-4 left-4 z-50"
    >
      <div className="bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {Object.values(RELATIONSHIPS).slice(0, 3).map((meta, i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full border border-[#111]"
                  style={{ backgroundColor: meta.color }}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-white">
              Connections
            </span>
            <span className="text-[10px] text-neutral-500">
              {visibleCount}/{totalConnections}
            </span>
          </div>
          <ChevronIcon expanded={isExpanded} />
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={TRANSITION_FAST}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 space-y-2">
                {/* Focus mode toggle */}
                <button
                  onClick={toggleFocusMode}
                  className={`
                    w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all duration-150
                    ${focusMode
                      ? 'bg-primary/20 border border-primary/30 text-primary'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white'
                    }
                  `}
                >
                  <FocusIcon />
                  <span className="text-xs font-medium">Focus Mode</span>
                  {focusMode && (
                    <span className="ml-auto text-[10px] bg-primary/30 px-1.5 py-0.5 rounded">
                      ON
                    </span>
                  )}
                </button>

                {/* Separator */}
                <div className="h-px bg-white/10" />

                {/* Relationship filters */}
                <div className="space-y-0.5">
                  {(Object.entries(RELATIONSHIPS) as [ConnectionRelationship, RelationshipMeta][]).map(
                    ([relationship, meta]) => (
                      <FilterToggle
                        key={relationship}
                        meta={meta}
                        enabled={connectionFilters[relationship]}
                        count={counts[relationship]}
                        onToggle={() => setConnectionFilter(relationship, !connectionFilters[relationship])}
                      />
                    )
                  )}
                </div>

                {/* AI suggested toggle */}
                {aiSuggestedCount > 0 && (
                  <>
                    <div className="h-px bg-white/10" />
                    <button
                      onClick={() => setConnectionFilter('showAISuggested', !connectionFilters.showAISuggested)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150
                        ${connectionFilters.showAISuggested
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                          : 'opacity-40 hover:opacity-60 text-neutral-500'
                        }
                      `}
                    >
                      <SparkleIcon />
                      <span className="text-xs font-medium">AI Suggested</span>
                      <span className={`
                        text-[10px] px-1.5 py-0.5 rounded-full ml-auto
                        ${connectionFilters.showAISuggested ? 'bg-emerald-500/20' : 'bg-white/5'}
                      `}>
                        {aiSuggestedCount}
                      </span>
                    </button>
                  </>
                )}

                {/* Reset button */}
                {(Object.values(connectionFilters).some(v => !v) || focusMode) && (
                  <button
                    onClick={resetConnectionFilters}
                    className="w-full text-[10px] text-neutral-500 hover:text-neutral-300 py-1 transition-colors"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
