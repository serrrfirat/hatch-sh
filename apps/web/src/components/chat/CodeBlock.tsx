import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@vibed/ui'

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
    <div className={cn('my-4 rounded-lg overflow-hidden border border-border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-tertiary border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-mono">{language || 'code'}</span>
          <span className="text-xs text-gray-600">{lineCount} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={cn(
              'text-xs transition-colors',
              copyError ? 'text-red-500' : 'text-gray-500 hover:text-white'
            )}
          >
            {copyError ? 'Failed!' : isCopied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>

      {/* Code content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <pre className="p-4 bg-bg-primary overflow-x-auto">
              <code className={`language-${language} text-sm font-mono leading-relaxed`}>
                {children}
              </code>
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {isCollapsed && (
        <div className="px-4 py-2 bg-bg-primary text-gray-600 text-sm">
          Code collapsed ({lineCount} lines)
        </div>
      )}
    </div>
  )
}
