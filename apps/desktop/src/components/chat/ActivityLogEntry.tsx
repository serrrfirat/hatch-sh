import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@hatch/ui'

// Smooth easing for animations
const smoothEase = [0.4, 0, 0.2, 1] as const

interface ActivityLogEntryProps {
  /** Icon or status indicator to show */
  icon?: ReactNode
  /** Main label text */
  label: string
  /** Secondary detail text */
  detail?: string
  /** Timestamp or duration to display */
  timestamp?: string
  /** Whether the entry is currently active/running */
  isActive?: boolean
  /** Whether this entry can be expanded */
  expandable?: boolean
  /** Content to show when expanded */
  children?: ReactNode
  /** Whether to start expanded */
  defaultExpanded?: boolean
  /** Custom class for the container */
  className?: string
  /** Entry type for styling variations */
  variant?: 'default' | 'user' | 'thinking' | 'tool' | 'content'
}

// Chevron icon that rotates
function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <motion.svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/30"
      animate={{ rotate: isExpanded ? 90 : 0 }}
      transition={{ duration: 0.2, ease: smoothEase }}
    >
      <polyline points="9 18 15 12 9 6" />
    </motion.svg>
  )
}

// Pulsing activity indicator for running items
function ActivityIndicator() {
  return (
    <motion.div
      className="w-1.5 h-1.5 rounded-full bg-blue-400"
      animate={{ opacity: [1, 0.4, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

// Checkmark icon for completed items
function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/40"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function ActivityLogEntry({
  icon,
  label,
  detail,
  timestamp,
  isActive = false,
  expandable = false,
  children,
  defaultExpanded = false,
  className,
  variant = 'default',
}: ActivityLogEntryProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const handleToggle = () => {
    if (expandable && children) {
      setIsExpanded(!isExpanded)
    }
  }

  const canExpand = expandable && children

  return (
    <div className={cn('font-mono', className)}>
      {/* Entry header */}
      <button
        onClick={handleToggle}
        disabled={!canExpand}
        className={cn(
          'w-full flex items-center gap-2 py-1.5 text-left transition-colors duration-150',
          canExpand ? 'hover:bg-white/[0.02] cursor-pointer' : 'cursor-default',
          variant === 'user' && 'py-2'
        )}
      >
        {/* Expand/collapse chevron or icon */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {canExpand ? (
            <ChevronIcon isExpanded={isExpanded} />
          ) : icon ? (
            icon
          ) : isActive ? (
            <ActivityIndicator />
          ) : (
            <CheckIcon />
          )}
        </div>

        {/* Label */}
        <span
          className={cn(
            'text-sm shrink-0',
            variant === 'user' ? 'text-white/90 font-medium' : 'text-white/50',
            variant === 'thinking' && 'text-white/40 italic',
            variant === 'tool' && 'text-white/50'
          )}
        >
          {label}
        </span>

        {/* Detail */}
        {detail && (
          <span
            className={cn(
              'text-sm truncate',
              variant === 'user' ? 'text-white' : 'text-white/70'
            )}
          >
            {detail}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Timestamp */}
        {timestamp && (
          <span className="text-xs text-white/20 shrink-0 tabular-nums">
            {timestamp}
          </span>
        )}
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: smoothEase }}
            className="overflow-hidden"
          >
            <div className="pl-6 pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * User prompt entry in the activity log
 */
export function UserPromptEntry({ content }: { content: string }) {
  return (
    <div className="py-3 border-b border-white/[0.06]">
      <div className="flex items-start gap-2">
        <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-mono text-white/30 uppercase tracking-wider">
            You
          </span>
          <p className="text-sm text-white mt-1 leading-relaxed">
            {content}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Group of activity log entries
 */
export function ActivityGroup({
  title,
  count,
  children,
  className,
}: {
  title: string
  count?: number
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('', className)}>
      <div className="flex items-center gap-2 py-2">
        <span className="text-xs font-mono text-white/30 uppercase tracking-wider">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-xs font-mono text-white/20">
            ({count})
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  )
}
