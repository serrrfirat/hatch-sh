import { useRef, useEffect, useState, useMemo } from 'react'
import { useChat } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ChatSearch } from './ChatSearch'
import { ContextMeter } from './ContextMeter'
import { WelcomeScreen } from './WelcomeScreen'
import { WorkspaceInitScreen } from './WorkspaceInitScreen'
import { useSettingsStore, isWorkspaceAgentReady } from '../../stores/settingsStore'
import { useRepositoryStore } from '../../stores/repositoryStore'
import { useChatStore } from '../../stores/chatStore'
import { isLocalAgent } from '../../lib/agents/types'
import { useDeploy, type DeployTarget } from '../../hooks/useDeploy'
import { DeployTargetSelector } from './DeployTargetSelector'
import { DeploymentStatus } from './DeploymentStatus'
import { useProjectStore } from '../../stores/projectStore'
import { Rocket, Loader2 } from 'lucide-react'

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
  const { currentProject } = useProjectStore()
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'
  const deployState = useDeploy(`${API_URL}/api`)
  const [deployTarget, setDeployTarget] = useState<DeployTarget>('cloudflare')

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

  const handleRetryInterruptedMessage = (assistantMessageId: string) => {
    if (isLoading) {
      return
    }

    const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId)
    if (assistantIndex <= 0) {
      return
    }

    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      const candidate = messages[index]
      if (candidate?.role === 'user') {
        void sendMessage(candidate.content, candidate.images)
        return
      }
    }
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
        {/* Deploy bar */}
        <div className="px-4 py-2 border-t border-white/[0.06]">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <DeployTargetSelector value={deployTarget} onChange={setDeployTarget} />
            <button
              onClick={() => deployState.deploy(currentProject?.id ?? '', deployTarget)}
              disabled={deployState.status === 'deploying' || !currentProject}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deployState.status === 'deploying' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              Deploy
            </button>
          </div>
          {deployState.status !== 'idle' && (
            <div className="max-w-3xl mx-auto mt-2">
              <DeploymentStatus
                status={deployState.status}
                url={deployState.url}
                error={deployState.error}
                target={deployState.target}
              />
              {deployState.status === 'success' && (
                <button
                  onClick={deployState.reset}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  New Deploy
                </button>
              )}
            </div>
          )}
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
      <ContextMeter />
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
              <MessageBubble
                key={message.id}
                message={message}
                onRetry={handleRetryInterruptedMessage}
                retryDisabled={isLoading || needsAgent}
              />
            ))}
          </div>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      {/* Deploy bar */}
      <div className="px-4 py-2 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <DeployTargetSelector value={deployTarget} onChange={setDeployTarget} />
          <button
            onClick={() => deployState.deploy(currentProject?.id ?? '', deployTarget)}
            disabled={deployState.status === 'deploying' || !currentProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deployState.status === 'deploying' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            Deploy
          </button>
        </div>
        {deployState.status !== 'idle' && (
          <div className="max-w-3xl mx-auto mt-2">
            <DeploymentStatus
              status={deployState.status}
              url={deployState.url}
              error={deployState.error}
              target={deployState.target}
            />
            {deployState.status === 'success' && (
              <button
                onClick={deployState.reset}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                New Deploy
              </button>
            )}
          </div>
        )}
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
