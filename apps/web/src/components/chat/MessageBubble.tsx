import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'
import { cn } from '@hatch/ui'
import { CodeBlock } from './CodeBlock'
import type { Message } from '../../stores/chatStore'
import type { Components } from 'react-markdown'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

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
          className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-sm"
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
      return <p className="mb-3 last:mb-0 text-gray-200 leading-relaxed">{children}</p>
    },
    ul({ children }) {
      return <ul className="list-disc pl-6 mb-3 space-y-1 text-gray-200">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal pl-6 mb-3 space-y-1 text-gray-200">{children}</ol>
    },
    li({ children }) {
      return <li className="text-gray-200">{children}</li>
    },
    h1({ children }) {
      return <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0 text-white border-b border-white/10 pb-2">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-lg font-bold mb-2 mt-4 first:mt-0 text-white">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-white">{children}</h3>
    },
    h4({ children }) {
      return <h4 className="text-sm font-semibold mb-2 mt-3 first:mt-0 text-white">{children}</h4>
    },
    a({ href, children }) {
      return (
        <a href={href} className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    },
    strong({ children }) {
      return <strong className="font-semibold text-white">{children}</strong>
    },
    em({ children }) {
      return <em className="italic text-gray-300">{children}</em>
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-white/20 pl-4 my-3 text-gray-400 italic">
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
      return <td className="px-3 py-2 text-gray-200">{children}</td>
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
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {message.content || (message.isStreaming ? '...' : '')}
            </ReactMarkdown>
          </div>

          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-accent-green animate-pulse ml-1" />
          )}
        </div>
      </div>
    </motion.div>
  )
}
