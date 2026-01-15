import { useRef, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChat } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { WelcomeScreen } from './WelcomeScreen'
import { useSettingsStore, isAgentReady } from '../../stores/settingsStore'

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

  // Check if local agent mode but agent not connected
  const needsAgent = agentMode !== 'cloud' && !isAgentReady(settingsState)

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen onSendMessage={sendMessage} needsAgent={needsAgent} />
        ) : (
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>

            {/* Thinking indicator is now shown in the MessageBubble itself */}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading}
        onStop={stopGeneration}
        disabled={needsAgent}
      />
    </div>
  )
}
