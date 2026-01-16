import { useRef, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChat } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { WelcomeScreen } from './WelcomeScreen'
import { WorkspaceInitScreen } from './WorkspaceInitScreen'
import { useSettingsStore, isWorkspaceAgentReady } from '../../stores/settingsStore'
import { useRepositoryStore } from '../../stores/repositoryStore'
import { useChatStore } from '../../stores/chatStore'
import { isLocalAgent } from '../../lib/agents/types'

export function ChatArea() {
  const { messages, isLoading, workspaceAgentId, sendMessage, sendOpenPRMessage, stopGeneration } = useChat()
  const settingsState = useSettingsStore()
  const { currentWorkspace, currentRepository } = useRepositoryStore()
  const { pendingOpenPR, clearPendingOpenPR } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(0)

  // Auto-scroll to bottom only when new messages are added (not on content updates)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages.length])

  // Watch for pending "Open PR" request from header button
  useEffect(() => {
    if (pendingOpenPR && !isLoading) {
      clearPendingOpenPR()
      sendOpenPRMessage(pendingOpenPR.uncommittedChanges)
    }
  }, [pendingOpenPR, isLoading, clearPendingOpenPR, sendOpenPRMessage])

// Check if workspace's agent requires setup (only for local agents)
  const needsAgent = isLocalAgent(workspaceAgentId) && !isWorkspaceAgentReady(settingsState, workspaceAgentId)

  // Determine which view to show
  const hasWorkspace = currentWorkspace !== null
  const hasMessages = messages.length > 0

  // No workspace selected → WelcomeScreen
  if (!hasWorkspace) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <WelcomeScreen />
        </div>
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          onStop={stopGeneration}
          disabled={true}
        />
      </div>
    )
  }

  // Workspace selected but no messages → WorkspaceInitScreen
  if (hasWorkspace && !hasMessages) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <WorkspaceInitScreen
            workspace={currentWorkspace}
            repository={currentRepository}
          />
        </div>
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          onStop={stopGeneration}
          disabled={needsAgent}
        />
      </div>
    )
  }

  // Workspace selected with messages → Chat conversation
  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="max-w-3xl mx-auto py-8">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
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
