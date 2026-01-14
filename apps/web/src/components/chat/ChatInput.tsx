import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Button, cn } from '@vibed/ui'

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
