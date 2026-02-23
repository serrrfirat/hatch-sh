import { useRef, useEffect, useState, useMemo } from 'react'
import { useChat } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ChatSearch } from './ChatSearch'
import { WelcomeScreen } from './WelcomeScreen'
import { WorkspaceInitScreen } from './WorkspaceInitScreen'
import { useSettingsStore, isWorkspaceAgentReady } from '../../stores/settingsStore'
import { useRepositoryStore } from '../../stores/repositoryStore'
import { useChatStore } from '../../stores/chatStore'
import { isLocalAgent } from '../../lib/agents/types'

export function ChatArea() {
  const { messages, isLoading, workspaceAgentId, sendMessage, sendOpenPRMessage, stopGeneration } =
    useChat()
  const settingsState = useSettingsStore()
  const { currentWorkspace, currentRepository } = useRepositoryStore()
  const { pendingOpenPR, clearPendingOpenPR } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLengthRef = useRef(0)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

  // Auto-scroll to bottom when new messages are added or when last message is streaming
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    const isLastMessageStreaming = lastMessage?.isStreaming ?? false

    // Scroll on new messages or while the last message is streaming
    if (messages.length > prevMessagesLengthRef.current || isLastMessageStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages])

  // Watch for pending "Open PR" request from header button
  useEffect(() => {
    if (pendingOpenPR && !isLoading) {
      clearPendingOpenPR()
      sendOpenPRMessage(pendingOpenPR.uncommittedChanges)
    }
  }, [pendingOpenPR, isLoading, clearPendingOpenPR, sendOpenPRMessage])

  // Check if workspace's agent requires setup (only for local agents)
  const needsAgent =
    isLocalAgent(workspaceAgentId) && !isWorkspaceAgentReady(settingsState, workspaceAgentId)

  // Determine which view to show
  const hasWorkspace = currentWorkspace !== null
  const hasMessages = messages.length > 0

  // Compute search matches (debounced via useMemo)
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    const matches: Array<{ messageId: string; messageIndex: number }> = []
    messages.forEach((message, index) => {
      if (message.content.toLowerCase().includes(query)) {
        matches.push({ messageId: message.id, messageIndex: index })
      }
    })
    return matches
  }, [searchQuery, messages])

  // Handle Cmd+F / Ctrl+F keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setIsSearchOpen(true)
        setSearchQuery('')
        setCurrentMatchIndex(0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchNext = () => {
    if (searchMatches.length === 0) return
    setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length)
  }

  const handleSearchPrevious = () => {
    if (searchMatches.length === 0) return
    setCurrentMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length)
  }

  const handleSearchClose = () => {
    setIsSearchOpen(false)
    setSearchQuery('')
    setCurrentMatchIndex(0)
  }

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
          <WorkspaceInitScreen workspace={currentWorkspace} repository={currentRepository} />
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
      {isSearchOpen && (
        <ChatSearch
          query={searchQuery}
          matchCount={searchMatches.length}
          currentMatchIndex={currentMatchIndex}
          onQueryChange={setSearchQuery}
          onNext={handleSearchNext}
          onPrevious={handleSearchPrevious}
          onClose={handleSearchClose}
        />
      )}
      {/* Activity log container */}
      <div
        className="flex-1 overflow-y-auto px-4 md:px-6"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.1) transparent',
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
