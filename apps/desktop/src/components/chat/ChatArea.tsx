import { useRef, useEffect } from 'react'
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

  // No workspace selected - WelcomeScreen
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

  // Workspace selected but no messages - WorkspaceInitScreen
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

  // Workspace selected with messages - Activity Log view
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Activity log container */}
      <div
        className="flex-1 overflow-y-auto px-4 md:px-6"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.1) transparent'
        }}
      >
        <div className="max-w-3xl mx-auto py-4">
          {/* Session header */}
          <div className="flex items-center gap-3 py-3 mb-2 border-b border-white/[0.06]">
            <div className="w-2 h-2 rounded-full bg-green-400/60" />
            <span className="text-xs font-sans font-light text-white/30 uppercase tracking-wider">
              Session Active
            </span>
            <div className="flex-1" />
            <span className="text-xs font-sans font-light text-white/20">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Activity log entries */}
          <div className="space-y-1">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
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
