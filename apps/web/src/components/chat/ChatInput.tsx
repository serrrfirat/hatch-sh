import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { cn } from '@hatch/ui'

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
    <div className="flex justify-center p-4 bg-neutral-950">
      <div className="w-full max-w-3xl">
        <div
          className={cn(
            'relative rounded-2xl overflow-hidden',
            'bg-gradient-to-b from-neutral-900 to-neutral-950',
            'shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)]'
          )}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="p-4">
            {/* Input area */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "What do you want to build?"}
              disabled={isLoading}
              rows={1}
              className={cn(
                'w-full bg-transparent text-white placeholder:text-neutral-600',
                'focus:outline-none resize-none text-sm leading-relaxed max-h-40',
                'disabled:opacity-50'
              )}
            />

            {/* Actions bar */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                {/* Attachment button - icon only */}
                <button className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                <div className="w-px h-4 bg-white/10" />
                <span className="text-[10px] text-neutral-700 px-1">⌘+Enter to send</span>
              </div>

              {/* Action Button */}
              {isLoading ? (
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                  </svg>
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                    message.trim()
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-white/5 text-neutral-600 cursor-not-allowed'
                  )}
                >
                  Send
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
