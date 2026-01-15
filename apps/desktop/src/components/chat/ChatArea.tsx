import { useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useChat } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { WelcomeScreen } from './WelcomeScreen'
import { useSettingsStore, isBYOAReady } from '../../stores/settingsStore'

export function ChatArea() {
  const { messages, isLoading, agentMode, sendMessage, stopGeneration } = useChat()
  const settingsState = useSettingsStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(0)

  // Auto-scroll to bottom only when new messages are added (not on content updates)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages.length])

  const showWelcome = messages.length === 0

  // Check if BYOA mode but Claude Code not connected
  const needsClaudeCode = agentMode === 'byoa' && !isBYOAReady(settingsState)

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen onSendMessage={sendMessage} needsClaudeCode={needsClaudeCode} />
        ) : (
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 px-6 py-4"
              >
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                  <motion.div
                    className="w-4 h-4 rounded-full bg-white/20"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                </div>
                <span className="font-mono text-sm text-neutral-400">
                  Generating code...
                </span>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading}
        onStop={stopGeneration}
        disabled={needsClaudeCode}
      />
    </div>
  )
}
