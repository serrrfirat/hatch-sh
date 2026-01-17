import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import { CodeBlock } from './CodeBlock'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolUseBlock } from './ToolUseBlock'
import { ChangedFilesPills } from './ChangedFilesPills'
import type { Message } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { Components } from 'react-markdown'

// Smooth easing for animations
const smoothEase = [0.4, 0, 0.2, 1] as const

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs.toFixed(0)}s`
}

interface MessageBubbleProps {
  message: Message
}

/**
 * Hook for typewriter effect on streaming messages
 */
function useTypewriterContent(content: string, isStreaming: boolean) {
  const [displayedContent, setDisplayedContent] = useState('')
  const [isComplete, setIsComplete] = useState(!isStreaming)
  const targetContentRef = useRef(content)
  const animationFrameRef = useRef<number | null>(null)
  const lastUpdateRef = useRef(0)

  useEffect(() => {
    targetContentRef.current = content

    // If not streaming anymore, show full content
    if (!isStreaming) {
      setDisplayedContent(content)
      setIsComplete(true)
      return
    }

    // Typewriter animation - reveal 1 character every 10ms
    const animate = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= 10) {
        lastUpdateRef.current = timestamp

        setDisplayedContent((prev) => {
          const target = targetContentRef.current
          if (prev.length < target.length) {
            // Reveal next character
            return target.slice(0, prev.length + 1)
          }
          return prev
        })
      }

      // Continue animation if we're still behind
      if (displayedContent.length < targetContentRef.current.length) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [content, isStreaming, displayedContent.length])

  const isThinking = isStreaming && !content

  return { displayedContent: displayedContent || '', isComplete, isThinking }
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

// Pulsing activity indicator
function ActivityIndicator() {
  return (
    <motion.div
      className="w-1.5 h-1.5 rounded-full bg-blue-400"
      animate={{ opacity: [1, 0.4, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const { displayedContent, isComplete, isThinking } = useTypewriterContent(
    message.content,
    message.isStreaming ?? false
  )

  const { thinkingEnabled } = useSettingsStore()
  const [isToolsExpanded, setIsToolsExpanded] = useState(false) // Collapsed by default

  const hasToolUses = !isUser && message.toolUses && message.toolUses.length > 0
  const hasThinking = !isUser && message.thinking && thinkingEnabled
  const isStreaming = message.isStreaming ?? false
  const toolCount = message.toolUses?.length || 0

  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const content = String(children).replace(/\n$/, '')

      const isCodeBlock = match || content.includes('\n')

      if (isCodeBlock) {
        return <CodeBlock language={match?.[1]}>{content}</CodeBlock>
      }

      return (
        <code
          className="bg-white/5 px-1.5 py-0.5 rounded text-white/90 font-mono text-xs"
          {...props}
        >
          {children}
        </code>
      )
    },
    pre({ children }) {
      return <>{children}</>
    },
    p({ children }) {
      return <p className="mb-3 last:mb-0 text-white/80 text-sm leading-relaxed">{children}</p>
    },
    ul({ children }) {
      return <ul className="list-disc list-outside ml-4 mb-3 text-white/80 text-sm leading-relaxed space-y-1">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal list-outside ml-4 mb-3 text-white/80 text-sm leading-relaxed space-y-1">{children}</ol>
    },
    li({ children }) {
      return <li className="text-white/80">{children}</li>
    },
    h1({ children }) {
      return <h1 className="text-lg font-medium tracking-tight mb-3 text-white">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-base font-medium tracking-tight mb-2 text-white">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-sm font-medium tracking-tight mb-2 text-white">{children}</h3>
    },
    h4({ children }) {
      return <h4 className="text-sm font-medium tracking-tight mb-2 text-white">{children}</h4>
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      )
    },
    strong({ children }) {
      return <strong className="font-semibold text-white">{children}</strong>
    },
    em({ children }) {
      return <em className="italic text-white/70">{children}</em>
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-white/20 pl-3 my-3 text-white/60 italic text-sm">
          {children}
        </blockquote>
      )
    },
    hr() {
      return <hr className="border-white/10 my-4" />
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-3">
          <table className="min-w-full border-collapse text-xs font-sans">
            {children}
          </table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-white/5 border-b border-white/10">{children}</thead>
    },
    tbody({ children }) {
      return <tbody className="divide-y divide-white/5">{children}</tbody>
    },
    tr({ children }) {
      return <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>
    },
    th({ children }) {
      return <th className="px-2 py-1.5 text-left font-semibold text-white">{children}</th>
    },
    td({ children }) {
      return <td className="px-2 py-1.5 text-white/80">{children}</td>
    },
  }

  // User message - right-aligned with dark grey box
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="py-3 flex justify-end"
      >
        <div className="max-w-[80%] bg-neutral-800 rounded-2xl rounded-br-sm px-4 py-3">
          <p className="text-sm font-normal text-white leading-relaxed">
            {message.content}
          </p>
        </div>
      </motion.div>
    )
  }

  // Assistant message - activity log style
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="py-2 font-sans"
    >
      {/* Thinking block */}
      {hasThinking && (
        <ThinkingBlock
          thinking={message.thinking!}
          isStreaming={isStreaming}
        />
      )}

      {/* Show processing indicator when waiting for first response */}
      {isThinking && !hasThinking && !hasToolUses && (
        <div className="flex items-center gap-2 py-2 text-white/40 text-sm">
          <ActivityIndicator />
          <span>Processing...</span>
        </div>
      )}

      {/* Tool uses - collapsed summary by default */}
      {hasToolUses && (
        <div className="py-1">
          {/* Summary header - always visible */}
          <button
            onClick={() => setIsToolsExpanded(!isToolsExpanded)}
            className="w-full flex items-center gap-2 py-1.5 hover:bg-white/[0.02] transition-colors duration-150 text-left group"
          >
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <ChevronIcon isExpanded={isToolsExpanded} />
            </div>
            <span className="text-sm text-white/50">
              {toolCount} tool call{toolCount !== 1 ? 's' : ''}
            </span>
            {isStreaming && (
              <ActivityIndicator />
            )}
            <div className="flex-1" />
            {message.duration !== undefined && !isStreaming && (
              <span className="text-xs text-white/20 tabular-nums">
                {formatDuration(message.duration)}
              </span>
            )}
          </button>

          {/* Expandable tool details */}
          <AnimatePresence>
            {isToolsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: smoothEase }}
                className="overflow-hidden"
              >
                <div className="pl-6 space-y-0.5 py-1">
                  {message.toolUses!.map((tool) => (
                    <ToolUseBlock key={tool.id} tool={tool} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Response content - always visible */}
      {displayedContent && (
        <div className="py-2">
          <div className="pt-1 pb-1">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {displayedContent}
            </ReactMarkdown>

            {!isComplete && (
              <motion.span
                className="inline-block w-[2px] h-4 bg-white/60 ml-0.5 align-middle"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              />
            )}
          </div>
        </div>
      )}

      {/* Changed files pills - shown after tool calls complete */}
      {hasToolUses && !isStreaming && (
        <ChangedFilesPills toolUses={message.toolUses!} />
      )}
    </motion.div>
  )
}
