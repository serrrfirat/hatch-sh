# Agent Task: Chat Interface

## Priority: HIGH - Core feature
## Depends on: Module 1 (Foundation), Module 2 (UI Components)
## Estimated Time: 4-5 hours

## Objective
Build the chat-first interface where users interact with Claude AI to generate apps. Includes message rendering with markdown, syntax-highlighted code blocks, streaming responses, and collapsible code sections.

## Tasks

### 1. Install Dependencies
```bash
cd apps/web
pnpm add react-markdown remark-gfm rehype-highlight zustand
pnpm add @types/hast -D
```

### 2. Create Chat Store
Create `apps/web/src/stores/chatStore.ts`:
```typescript
import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

interface ChatState {
  messages: Message[]
  isLoading: boolean
  currentProjectId: string | null
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, content: string) => void
  setLoading: (loading: boolean) => void
  setProjectId: (id: string) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  currentProjectId: null,

  addMessage: (message) => {
    const id = crypto.randomUUID()
    set((state) => ({
      messages: [...state.messages, { ...message, id, timestamp: new Date() }],
    }))
    return id
  },

  updateMessage: (id, content) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content, isStreaming: false } : msg
      ),
    }))
  },

  setLoading: (isLoading) => set({ isLoading }),
  setProjectId: (currentProjectId) => set({ currentProjectId }),
  clearMessages: () => set({ messages: [] }),
}))
```

### 3. Create useChat Hook
Create `apps/web/src/hooks/useChat.ts`:
```typescript
import { useCallback, useRef } from 'react'
import { useChatStore } from '../stores/chatStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export function useChat() {
  const {
    messages,
    isLoading,
    currentProjectId,
    addMessage,
    updateMessage,
    setLoading,
  } = useChatStore()

  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    if (!currentProjectId || !content.trim()) return

    // Add user message
    addMessage({ role: 'user', content })

    // Create placeholder for assistant response
    const assistantMessageId = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    setLoading(true)

    try {
      abortControllerRef.current = new AbortController()

      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProjectId,
          message: content,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error('Chat request failed')
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) {
                fullContent += data.text
                updateMessage(assistantMessageId, fullContent)
              }
              if (data.done) break
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      updateMessage(assistantMessageId, 'Sorry, an error occurred. Please try again.')
      console.error('Chat error:', error)
    } finally {
      setLoading(false)
    }
  }, [currentProjectId, addMessage, updateMessage, setLoading])

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    setLoading(false)
  }, [setLoading])

  return {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
  }
}
```

### 4. Create Code Block Component
Create `apps/web/src/components/chat/CodeBlock.tsx`:
```typescript
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@hatch/ui'

interface CodeBlockProps {
  language?: string
  children: string
  className?: string
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
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
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            {isCopied ? 'Copied!' : 'Copy'}
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
```

### 5. Create Message Bubble Component
Create `apps/web/src/components/chat/MessageBubble.tsx`:
```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'
import { cn } from '@hatch/ui'
import { CodeBlock } from './CodeBlock'
import type { Message } from '../../stores/chatStore'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

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
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const content = String(children).replace(/\n$/, '')

                if (!inline && match) {
                  return <CodeBlock language={match[1]}>{content}</CodeBlock>
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
                  <a href={href} className="text-accent-green hover:underline" target="_blank" rel="noopener">
                    {children}
                  </a>
                )
              },
            }}
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
```

### 6. Create Chat Input Component
Create `apps/web/src/components/chat/ChatInput.tsx`:
```typescript
import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { Button, cn } from '@hatch/ui'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
  onStop?: () => void
  placeholder?: string
}

export function ChatInput({ onSend, isLoading, onStop, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSend(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border bg-bg-secondary p-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "What do you want to build?"}
            disabled={isLoading}
            rows={1}
            className={cn(
              'w-full bg-bg-tertiary border border-border rounded-xl px-4 py-3',
              'text-white placeholder:text-gray-600',
              'focus:outline-none focus:border-accent-green focus:ring-1 focus:ring-accent-green/20',
              'resize-none max-h-40 transition-all',
              'disabled:opacity-50'
            )}
          />
          <span className="absolute right-3 bottom-3 text-xs text-gray-600">
            ⌘ + Enter to send
          </span>
        </div>

        {isLoading ? (
          <Button variant="danger" onClick={onStop} size="lg">
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!message.trim()}
            size="lg"
          >
            Send
          </Button>
        )}
      </div>
    </div>
  )
}
```

### 7. Create Chat Area Component
Create `apps/web/src/components/chat/ChatArea.tsx`:
```typescript
import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { WelcomeScreen } from './WelcomeScreen'

export function ChatArea() {
  const { messages, isLoading, sendMessage, stopGeneration } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showWelcome = messages.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen onSendMessage={sendMessage} />
        ) : (
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading}
        onStop={stopGeneration}
      />
    </div>
  )
}
```

### 8. Create Welcome Screen Component
Create `apps/web/src/components/chat/WelcomeScreen.tsx`:
```typescript
import { motion } from 'framer-motion'
import { Card, slideUp, staggerContainer } from '@hatch/ui'

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void
}

const SUGGESTIONS = [
  {
    title: 'Todo App',
    prompt: 'Build a simple todo app with add, complete, and delete functionality',
  },
  {
    title: 'Weather Widget',
    prompt: 'Create a weather widget that shows temperature and conditions',
  },
  {
    title: 'Countdown Timer',
    prompt: 'Make a countdown timer with start, pause, and reset buttons',
  },
  {
    title: 'Quote Generator',
    prompt: 'Build a random quote generator with a nice card design',
  },
]

export function WelcomeScreen({ onSendMessage }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="text-center max-w-2xl"
      >
        <motion.h1
          variants={slideUp}
          className="text-4xl font-bold mb-2 text-gradient"
        >
          What do you want to build?
        </motion.h1>
        <motion.p
          variants={slideUp}
          className="text-gray-500 mb-8"
        >
          Describe your app and I'll generate the code. Then deploy and launch your token.
        </motion.p>

        {/* Suggestion cards */}
        <motion.div
          variants={slideUp}
          className="grid grid-cols-2 gap-3"
        >
          {SUGGESTIONS.map((suggestion) => (
            <Card
              key={suggestion.title}
              variant="bordered"
              hoverable
              onClick={() => onSendMessage(suggestion.prompt)}
              className="text-left cursor-pointer"
            >
              <h3 className="font-semibold text-white mb-1">{suggestion.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{suggestion.prompt}</p>
            </Card>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
```

### 9. Create Streaming Text Component (Optional Enhancement)
Create `apps/web/src/components/chat/StreamingText.tsx`:
```typescript
import { useEffect, useState } from 'react'

interface StreamingTextProps {
  text: string
  speed?: number
  onComplete?: () => void
}

export function StreamingText({ text, speed = 20, onComplete }: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed)
      return () => clearTimeout(timer)
    } else if (onComplete) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  return <span>{displayedText}</span>
}
```

## Directory Structure
```
apps/web/src/
├── components/
│   └── chat/
│       ├── ChatArea.tsx
│       ├── ChatInput.tsx
│       ├── MessageBubble.tsx
│       ├── CodeBlock.tsx
│       ├── WelcomeScreen.tsx
│       └── StreamingText.tsx
├── hooks/
│   └── useChat.ts
└── stores/
    └── chatStore.ts
```

## Definition of Done
- [ ] Can type messages and send to AI
- [ ] AI responses stream in real-time
- [ ] Markdown renders correctly (headers, lists, links)
- [ ] Code blocks have syntax highlighting
- [ ] Code blocks are collapsible
- [ ] Copy button works on code blocks
- [ ] Welcome screen shows for new projects
- [ ] Auto-scroll to latest message
- [ ] Stop button cancels generation

## Environment Variables
```
VITE_API_URL=http://localhost:8787
```

## Notes
- Chat connects to backend /api/chat endpoint
- Streaming uses Server-Sent Events (SSE)
- Code is extracted and saved to project for preview
- Keep markdown styling consistent with degen theme
