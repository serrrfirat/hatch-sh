import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'
import { cn } from '@vibed/ui'
import { CodeBlock } from './CodeBlock'
import type { Message } from '../../stores/chatStore'
import type { Components } from 'react-markdown'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

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
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={components}
          >
            {message.content || (message.isStreaming ? '...' : '')}
          </ReactMarkdown>

          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-accent-green animate-pulse ml-1" />
          )}
        </div>
      </div>
    </motion.div>
  )
}
