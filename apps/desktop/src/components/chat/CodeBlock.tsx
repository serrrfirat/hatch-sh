import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@hatch/ui'

// Smooth easing for animations
const smoothEase = [0.4, 0, 0.2, 1] as const

interface CodeBlockProps {
  language?: string
  children: string
  className?: string
}

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

export function CodeBlock({ language, children, className }: CodeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(children)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // intentionally empty
    }
  }
  const lineCount = children.split('\n').length

  return (
    <div className={cn('my-3 bg-white/[0.02] rounded', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors duration-150 text-left"
      >
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          <ChevronIcon isExpanded={isExpanded} />
        </div>
        <span className="text-xs font-sans font-light text-white/40 uppercase">
          {language || 'code'}
        </span>
        <span className="text-xs font-sans font-light text-white/20">
          {lineCount} line{lineCount !== 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <button
          onClick={handleCopy}
          className={cn(
            'text-xs font-sans font-light uppercase tracking-wider transition-colors duration-150 px-2 py-0.5 rounded',
            isCopied
              ? 'text-green-400/70'
              : 'text-white/30 hover:text-white/50 hover:bg-white/5'
          )}
        >
          {isCopied ? 'copied' : 'copy'}
        </button>
      </button>

      {/* Code content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: smoothEase }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <pre className="overflow-x-auto">
                <code className="text-xs font-mono leading-relaxed text-white/60">
                  {children}
                </code>
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed preview */}
      {!isExpanded && (
        <div className="px-3 pb-2">
          <code className="text-xs font-mono text-white/30 truncate block">
            {children.split('\n')[0]}{lineCount > 1 ? '...' : ''}
          </code>
        </div>
      )}
    </div>
  )
}
