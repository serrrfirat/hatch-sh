import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@vibed/ui'

// Editorial easing - smooth, elegant motion
const editorialEase = [0.16, 1, 0.3, 1] as const

interface CodeBlockProps {
  language?: string
  children: string
  className?: string
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      setCopyError(true)
      setTimeout(() => setCopyError(false), 2000)
    }
  }

  const lineCount = children.split('\n').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: editorialEase }}
      className={cn('my-6', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
            {language || 'code'}
          </span>
          <span className="text-xs font-mono text-white/20">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleCopy}
            className={cn(
              'text-xs font-mono uppercase tracking-wider transition-colors duration-300',
              copyError
                ? 'text-red-400'
                : isCopied
                  ? 'text-white'
                  : 'text-white/30 hover:text-white/60'
            )}
          >
            {copyError ? 'Failed' : isCopied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-white/30 hover:text-white/60 transition-colors duration-300"
          >
            <motion.svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              animate={{ rotate: isCollapsed ? 0 : 45 }}
              transition={{ duration: 0.3, ease: editorialEase }}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </motion.svg>
          </button>
        </div>
      </div>

      {/* Code content */}
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: editorialEase }}
            className="overflow-hidden"
          >
            <pre className="pt-4 overflow-x-auto">
              <code className="text-sm font-mono leading-[1.8] text-white/70">
                {children}
              </code>
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed state */}
      <AnimatePresence>
        {isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pt-3 text-sm font-mono text-white/30"
          >
            {lineCount} lines collapsed
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
