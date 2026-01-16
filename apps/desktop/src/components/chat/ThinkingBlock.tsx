import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
}

// Smooth easing for animations
const smoothEase = [0.4, 0, 0.2, 1] as const

// Chevron icon for expandable sections
function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <motion.svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/30"
      animate={{ rotate: isExpanded ? 90 : 0 }}
      transition={{ duration: 0.15, ease: smoothEase }}
    >
      <polyline points="9 18 15 12 9 6" />
    </motion.svg>
  )
}

// Pulsing activity indicator
function ActivityIndicator() {
  return (
    <motion.div
      className="w-1.5 h-1.5 rounded-full bg-amber-400"
      animate={{ opacity: [1, 0.4, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

export function ThinkingBlock({ thinking, isStreaming }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  // Auto-collapse after streaming completes
  useEffect(() => {
    if (!isStreaming && thinking) {
      const timer = setTimeout(() => setIsExpanded(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, thinking])

  // Auto-scroll content when streaming
  useEffect(() => {
    if (isStreaming && contentRef.current && isExpanded) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [thinking, isStreaming, isExpanded])

  const lineCount = thinking.split('\n').filter(l => l.trim()).length

  return (
    <div className="py-1">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-1.5 hover:bg-white/[0.02] transition-colors duration-150 text-left"
      >
        {/* Chevron or activity indicator */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {isStreaming ? (
            <ActivityIndicator />
          ) : (
            <ChevronIcon isExpanded={isExpanded} />
          )}
        </div>

        {/* Label */}
        <span className="text-sm font-light text-white/40 italic">
          {isStreaming ? 'Thinking' : 'Thought'}
        </span>

        {/* Line count */}
        {!isStreaming && lineCount > 0 && (
          <span className="text-xs font-light text-white/20">
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <span className="text-xs font-light text-amber-400/70">live</span>
        )}

        <div className="flex-1" />
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && thinking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: smoothEase }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="pl-6 max-h-[200px] overflow-y-auto"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.1) transparent'
              }}
            >
              <p className="text-xs font-light text-white/40 leading-relaxed whitespace-pre-wrap py-2">
                {thinking}
                {isStreaming && (
                  <motion.span
                    className="inline-block w-[2px] h-3 bg-amber-400/60 ml-0.5 align-middle"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview when collapsed */}
      {!isExpanded && thinking && (
        <div className="pl-6 py-1">
          <p className="text-xs font-light text-white/25 truncate">
            {thinking.slice(0, 100)}{thinking.length > 100 ? '...' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
