import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'
import { cn } from '@vibed/ui'
import { CodeBlock } from './CodeBlock'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolUseBlock } from './ToolUseBlock'
import type { Message } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { Components } from 'react-markdown'

// Editorial easing - smooth, elegant motion
const editorialEase = [0.16, 1, 0.3, 1] as const

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

  // Handle content changes during streaming
  useEffect(() => {
    if (isStreaming && content.length > displayedContent.length) {
      // New content arrived, animation will pick it up
    }
  }, [content, isStreaming, displayedContent.length])

  const isThinking = isStreaming && !content

  return { displayedContent: displayedContent || '', isComplete, isThinking }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const { displayedContent, isComplete, isThinking } = useTypewriterContent(
    message.content,
    message.isStreaming ?? false
  )

  // thinkingEnabled is a display-only setting - Claude Code always generates thinking blocks,
  // but we can hide them in the UI based on user preference
  const { thinkingEnabled } = useSettingsStore()

  const hasToolUses = !isUser && message.toolUses && message.toolUses.length > 0
  const hasThinking = !isUser && message.thinking && thinkingEnabled
  const isStreaming = message.isStreaming ?? false

  // Show activity section when we have thinking (and it's enabled) or tool uses
  const showActivitySection = hasThinking || hasToolUses

  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const content = String(children).replace(/\n$/, '')

      // Check if this is a code block vs inline code
      // A code block either has a language specified OR is multiline
      const isCodeBlock = match || content.includes('\n')

      if (isCodeBlock) {
        return <CodeBlock language={match?.[1]}>{content}</CodeBlock>
      }

      return (
        <code
          className="bg-white/5 px-1.5 py-0.5 rounded text-white font-mono text-sm"
          {...props}
        >
          {children}
        </code>
      )
    },
    pre({ children }) {
      // Pre is handled by the code block, just pass through
      return <>{children}</>
    },
    p({ children }) {
      return <p className="mb-4 last:mb-0 text-white/80 leading-[1.8]">{children}</p>
    },
    ul({ children }) {
      return <ul className="list-disc list-outside ml-5 mb-4 text-white/80 leading-[1.8] space-y-1">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal list-outside ml-5 mb-4 text-white/80 leading-[1.8] space-y-1">{children}</ol>
    },
    li({ children }) {
      return <li className="text-white/80">{children}</li>
    },
    h1({ children }) {
      return <h1 className="text-2xl font-medium tracking-tight mb-4 text-white">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-xl font-medium tracking-tight mb-3 text-white">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-lg font-medium tracking-tight mb-2 text-white">{children}</h3>
    },
    h4({ children }) {
      return <h4 className="text-base font-medium tracking-tight mb-2 text-white">{children}</h4>
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          className="text-white underline underline-offset-4 hover:text-white/70 transition-colors duration-300"
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
        <blockquote className="border-l-2 border-white/20 pl-4 my-4 text-white/60 italic">
          {children}
        </blockquote>
      )
    },
    hr() {
      return <hr className="border-white/10 my-6" />
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full border-collapse text-sm">
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
      return <tr className="hover:bg-white/5 transition-colors">{children}</tr>
    },
    th({ children }) {
      return <th className="px-3 py-2 text-left font-semibold text-white">{children}</th>
    },
    td({ children }) {
      return <td className="px-3 py-2 text-white/80">{children}</td>
    },
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: editorialEase }}
      className="py-8"
    >
      {/* User message */}
      {isUser && (
        <div>
          <span className="text-xs font-mono text-white/30 uppercase tracking-wider block mb-3">
            You
          </span>
          <p className="text-xl text-white leading-relaxed font-medium">
            {message.content}
          </p>
        </div>
      )}

      {/* Assistant message */}
      {!isUser && (
        <div className="space-y-6">
          {/* Label */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-white/30 uppercase tracking-wider">
              Claude
            </span>
            {isStreaming && (
              <motion.div
                className="w-2 h-2 rounded-full bg-white"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>

          {/* Show thinking indicator when waiting for first response */}
          {isThinking && !showActivitySection && (
            <ThinkingIndicator />
          )}

          {/* Activity Section - Thinking and Tool Uses */}
          {showActivitySection && (
            <div className="space-y-6 pb-6 border-b border-white/10">
              {/* Thinking block */}
              {hasThinking && (
                <ThinkingBlock
                  thinking={message.thinking!}
                  isStreaming={isStreaming}
                />
              )}

              {/* Tool uses */}
              {hasToolUses && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-mono text-white/30 uppercase tracking-wider">
                      Activity
                    </span>
                    <span className="text-xs font-mono text-white/20">
                      ({message.toolUses!.length})
                    </span>
                  </div>
                  <div className="space-y-1">
                    {message.toolUses!.map((tool) => (
                      <ToolUseBlock key={tool.id} tool={tool} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main content */}
          {displayedContent && (
            <div className={cn(showActivitySection ? 'pt-2' : '')}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
              >
                {displayedContent}
              </ReactMarkdown>

              {!isComplete && (
                <motion.span
                  className="inline-block w-[2px] h-5 bg-white ml-0.5 align-middle"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                />
              )}
            </div>
          )}

          {/* Duration footer */}
          {message.duration !== undefined && !message.isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex items-center gap-4 text-xs font-mono text-white/20"
            >
              <span>{formatDuration(message.duration)}</span>
              {hasToolUses && (
                <span>
                  {message.toolUses!.length} tool{message.toolUses!.length !== 1 ? 's' : ''}
                </span>
              )}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  )
}
