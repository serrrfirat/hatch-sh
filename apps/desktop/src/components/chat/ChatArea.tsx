import { useRef, useEffect, useState, useCallback } from 'react'
import { useChat } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { WelcomeScreen } from './WelcomeScreen'
import { WorkspaceInitScreen } from './WorkspaceInitScreen'
import { useSettingsStore, isWorkspaceAgentReady } from '../../stores/settingsStore'
import { useRepositoryStore } from '../../stores/repositoryStore'
import { useChatStore } from '../../stores/chatStore'
import { isLocalAgent } from '../../lib/agents/types'
import { motion, AnimatePresence } from 'framer-motion'

export function ChatArea() {
  const { messages, isLoading, workspaceAgentId, sendMessage, sendOpenPRMessage, stopGeneration } = useChat()
  const settingsState = useSettingsStore()
  const { currentWorkspace, currentRepository } = useRepositoryStore()
  const { pendingOpenPR, clearPendingOpenPR } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(0)
  const wasLoadingRef = useRef(false)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Auto-scroll to bottom only when new messages are added (not on content updates)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages.length])

  // Auto-scroll to bottom when agent finishes responding (isLoading: true -> false)
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      // Agent just finished - scroll to the latest message
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    wasLoadingRef.current = isLoading
  }, [isLoading])

  // Check if user is at the bottom of the scroll container
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const threshold = 100 // pixels from bottom to consider "at bottom"
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    setIsAtBottom(distanceFromBottom <= threshold)
  }, [])

  // Scroll to bottom function - use scrollTop for reliability
  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [])

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
    <div className="flex flex-col h-full bg-[#0a0a0a] relative">
      {/* Activity log container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
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

      {/* Input area wrapper with scroll button */}
      <div className="relative">
        {/* Scroll to bottom pill - absolutely positioned above input */}
        <AnimatePresence>
          {!isAtBottom && messages.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              onClick={scrollToBottom}
              className="absolute -top-8 left-4 md:left-6 flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-full text-[11px] text-white/60 hover:text-white/80 transition-colors z-10"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              Scroll to bottom
            </motion.button>
          )}
        </AnimatePresence>

        {/* Input area */}
        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          onStop={stopGeneration}
          disabled={needsAgent}
        />
      </div>
    </div>
  )
}
