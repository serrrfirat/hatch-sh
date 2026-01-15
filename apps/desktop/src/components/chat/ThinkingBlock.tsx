import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, ChevronDown, ChevronRight } from 'lucide-react'

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
}

export function ThinkingBlock({ thinking, isStreaming }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Truncate thinking text for collapsed view
  const truncatedThinking = thinking.length > 100
    ? thinking.slice(0, 100) + '...'
    : thinking

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 transition-colors group"
      >
        <motion.div
          animate={isStreaming ? { rotate: 360 } : { rotate: 0 }}
          transition={isStreaming ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
        >
          <Settings className="w-4 h-4" />
        </motion.div>
        <span className="font-medium">Thinking</span>
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>

      <AnimatePresence>
        {!isExpanded && thinking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2"
          >
            <div className="bg-black/40 rounded-md px-3 py-2 font-mono text-xs text-white/50 overflow-hidden">
              {truncatedThinking}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && thinking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2"
          >
            <div className="bg-black/40 rounded-md px-3 py-2 font-mono text-xs text-white/50 max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {thinking}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
