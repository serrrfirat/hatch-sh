import { useState, useRef, useEffect, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@vibed/ui'
import { useSettingsStore } from '../../stores/settingsStore'
import { AgentPicker } from './AgentPicker'

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading: boolean
  onStop?: () => void
  placeholder?: string
  disabled?: boolean
}

// Brain icon for thinking mode
function BrainIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  )
}

// Map icon for plan mode
function MapIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <path d="M15 5.764v15" />
      <path d="M9 3.236v15" />
    </svg>
  )
}

// Minimal icon button with editorial styling
function ModeToggle({
  label,
  icon,
  isActive,
  onToggle,
}: {
  label: string
  icon: ReactNode
  isActive: boolean
  onToggle: () => void
}) {
  return (
    <motion.button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 py-1.5 px-3 rounded-full transition-colors duration-300",
        isActive
          ? "bg-white/10 text-white"
          : "text-white/40 hover:text-white/60 hover:bg-white/5"
      )}
      whileTap={{ scale: 0.95 }}
    >
      {icon}
      <span className="text-xs font-mono uppercase tracking-wider">
        {label}
      </span>
    </motion.button>
  )
}

export function ChatInput({ onSend, isLoading, onStop, placeholder, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    planModeEnabled,
    thinkingEnabled,
    setPlanModeEnabled,
    setThinkingEnabled
  } = useSettingsStore()

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
    <div className="border-t border-white/10 px-6 py-4">
      <div className="max-w-3xl mx-auto">
        {/* Agent Picker and Mode toggles */}
        <div className="flex items-center justify-between mb-4">
          <AgentPicker />
          <div className="flex items-center gap-8">
            <ModeToggle
              label="Plan"
              icon={<MapIcon />}
              isActive={planModeEnabled}
              onToggle={() => setPlanModeEnabled(!planModeEnabled)}
            />
            {/* Display-only toggle: hides/shows thinking blocks in the UI.
                Claude Code always generates thinking - this just controls visibility. */}
            <ModeToggle
              label="Thinking"
              icon={<BrainIcon />}
              isActive={thinkingEnabled}
              onToggle={() => setThinkingEnabled(!thinkingEnabled)}
            />
          </div>
        </div>

        {/* Input area */}
        <div className="flex items-end gap-4">
          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "What do you want to build?"}
              disabled={isLoading || disabled}
              rows={1}
              className={cn(
                'w-full bg-transparent border-b border-white/20 pb-3 pt-1',
                'text-lg text-white placeholder:text-white/30',
                'focus:outline-none focus:border-white/40',
                'resize-none max-h-40 transition-colors duration-300',
                'disabled:opacity-50'
              )}
            />
            <span className="absolute right-0 bottom-3 text-xs font-mono text-white/20">
              ⌘ + Enter
            </span>
          </div>

          {/* Action Button */}
          {isLoading ? (
            <motion.button
              onClick={onStop}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="1" />
              </svg>
            </motion.button>
          ) : (
            <motion.button
              onClick={handleSend}
              disabled={!message.trim()}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-300',
                message.trim()
                  ? 'bg-white text-black'
                  : 'border border-white/10 text-white/20 cursor-not-allowed'
              )}
              whileHover={message.trim() ? { scale: 1.05 } : {}}
              whileTap={message.trim() ? { scale: 0.95 } : {}}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
