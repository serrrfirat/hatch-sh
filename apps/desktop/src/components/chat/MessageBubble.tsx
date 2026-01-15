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
import type { Components } from 'react-markdown'

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

  const components: Components = {
    code({ className, children, node, ...props }) {
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
          className="bg-bg-tertiary px-1.5 py-0.5 rounded text-accent-green font-mono text-sm"
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
      return <p className="mb-2 last:mb-0 text-gray-200">{children}</p>
    },
    ul({ children }) {
      return <ul className="list-disc list-inside mb-2 text-gray-200">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal list-inside mb-2 text-gray-200">{children}</ol>
    },
    h1({ children }) {
      return <h1 className="text-xl font-bold mb-2 text-white">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-lg font-bold mb-2 text-white">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-base font-bold mb-2 text-white">{children}</h3>
    },
    a({ href, children }) {
      return (
        <a href={href} className="text-accent-green hover:underline" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    },
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'flex-row-reverse' : ''
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        isUser ? 'bg-accent-purple' : 'bg-accent-green'
      )}>
        <span className="text-xs font-bold text-black">
          {isUser ? 'U' : 'AI'}
        </span>
      </div>

      {/* Message content */}
      <div className={cn(
        'flex-1 min-w-0',
        isUser ? 'text-right' : ''
      )}>
        <div className={cn(
          'inline-block text-left max-w-full',
          isUser ? 'bg-bg-tertiary rounded-2xl rounded-tr-sm px-4 py-2' : ''
        )}>
          {isThinking ? (
            <ThinkingIndicator />
          ) : (
            <>
              {/* Thinking block for assistant messages */}
              {!isUser && message.thinking && (
                <ThinkingBlock
                  thinking={message.thinking}
                  isStreaming={message.isStreaming}
                />
              )}

              {/* Main content */}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
              >
                {displayedContent}
              </ReactMarkdown>

              {!isComplete && (
                <motion.span
                  className="inline-block w-0.5 h-4 bg-purple-400 ml-0.5 align-middle"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                />
              )}

              {/* Tool uses */}
              {!isUser && message.toolUses && message.toolUses.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {message.toolUses.map((tool) => (
                    <ToolUseBlock key={tool.id} tool={tool} />
                  ))}
                </div>
              )}

              {/* Duration */}
              {!isUser && message.duration !== undefined && !message.isStreaming && (
                <div className="mt-2 text-xs text-white/40">
                  {formatDuration(message.duration)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
