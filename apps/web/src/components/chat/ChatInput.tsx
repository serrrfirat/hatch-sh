import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { cn } from '@vibed/ui'

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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
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
    <div className="border-t border-white/10 bg-neutral-900 p-4">
      <div className="flex items-center gap-3">
        {/* Textarea */}
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
              'w-full bg-neutral-800 border border-white/10 rounded-xl px-4 py-3',
              'text-white placeholder:text-neutral-500',
              'focus:outline-none focus:border-white/20',
              'resize-none max-h-40 transition-all',
              'disabled:opacity-50'
            )}
          />
          <span className="absolute right-3 bottom-3 text-xs text-neutral-600">
            ⌘ + Enter
          </span>
        </div>

        {/* Action Button */}
        {isLoading ? (
          <button
            onClick={onStop}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-full transition-all',
              message.trim()
                ? 'bg-white text-black hover:scale-105 active:scale-95'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            )}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
