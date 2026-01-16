import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
}

// Editorial easing - smooth, elegant motion
const editorialEase = [0.16, 1, 0.3, 1]

// Letter animation for staggered reveals
const letterAnim = {
  initial: { y: "100%", opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.6, ease: editorialEase } }
}

const containerAnim = {
  animate: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    }
  }
}

export function ThinkingBlock({ thinking, isStreaming }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [hasAnimated, setHasAnimated] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Auto-collapse after streaming completes
  useEffect(() => {
    if (!isStreaming && thinking) {
      const timer = setTimeout(() => setIsExpanded(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, thinking])

  // Auto-scroll content when streaming
  useEffect(() => {
    if (isStreaming && contentRef.current && isExpanded) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [thinking, isStreaming, isExpanded])

  // Track animation completion
  useEffect(() => {
    if (!hasAnimated) {
      const timer = setTimeout(() => setHasAnimated(true), 800)
      return () => clearTimeout(timer)
    }
  }, [hasAnimated])

  const title = isStreaming ? "Thinking" : "Thought"

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: editorialEase }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full group cursor-pointer"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10 group-hover:border-white/20 transition-colors duration-500">
          {/* Title with staggered letter animation */}
          <div className="flex items-center gap-4">
            <h3 className="text-2xl font-medium tracking-tight flex overflow-hidden">
              {!hasAnimated ? (
                <motion.span
                  variants={containerAnim}
                  initial="initial"
                  animate="animate"
                  className="flex text-white"
                >
                  {title.split('').map((char, i) => (
                    <motion.span key={i} variants={letterAnim} className="inline-block">
                      {char}
                    </motion.span>
                  ))}
                </motion.span>
              ) : (
                <span className="text-white">{title}</span>
              )}
            </h3>

            {isStreaming && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <motion.div
                  className="w-2 h-2 rounded-full bg-white"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className="text-xs font-mono text-white/50 uppercase tracking-wider">
                  Live
                </span>
              </motion.div>
            )}
          </div>

          {/* Expand indicator */}
          <motion.div
            className="text-white/40 group-hover:text-white/60 transition-colors duration-300"
            animate={{ rotate: isExpanded ? 45 : 0 }}
            transition={{ duration: 0.4, ease: editorialEase }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </motion.div>
        </div>

        {/* Preview text when collapsed */}
        <AnimatePresence>
          {!isExpanded && thinking && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: editorialEase }}
              className="text-sm text-white/40 mt-3 text-left line-clamp-2 leading-relaxed"
            >
              {thinking.slice(0, 200)}{thinking.length > 200 ? '...' : ''}
            </motion.p>
          )}
        </AnimatePresence>
      </button>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isExpanded && thinking && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: editorialEase }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="pt-6 max-h-[400px] overflow-y-auto"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.1) transparent'
              }}
            >
              <p className="text-sm leading-[1.8] text-white/60 whitespace-pre-wrap">
                {thinking}
                {isStreaming && (
                  <motion.span
                    className="inline-block w-[2px] h-4 bg-white ml-1 align-middle"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </p>
            </div>

            {/* Footer */}
            <motion.div
              className="flex items-center justify-between pt-4 mt-4 border-t border-white/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <span className="text-xs font-mono text-white/30">
                {thinking.split('\n').filter(l => l.trim()).length} lines
              </span>
              <span className="text-xs font-mono text-white/30">
                {thinking.length.toLocaleString()} chars
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
