import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Send,
  Lightbulb,
  Link2,
  MessageSquare,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useIdeaMazeStore } from '../../stores/ideaMazeStore'
import { useIdeaMazeChat } from '../../hooks/useIdeaMazeChat'
import {
  staggerContainerVariants,
  staggerItemVariants,
  COLORS,
} from '../../lib/ideaMaze/animations'

type TabId = 'chat' | 'suggestions'

export function IdeaMazeSidebar() {
  const [activeTab, setActiveTab] = useState<TabId>('chat')
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const {
    aiSuggestions,
    selection,
    currentMoodboard,
    acceptAISuggestion,
    removeAISuggestion,
  } = useIdeaMazeStore()

  const {
    chatMessages,
    isProcessing,
    sendMessage,
    findConnections,
    generateIdeas,
    critiqueIdeas,
    isReady,
  } = useIdeaMazeChat()

  const selectedNodes = currentMoodboard?.nodes.filter((n) =>
    selection.nodeIds.includes(n.id)
  ) || []

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  // Clear error after a delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return

    const message = inputValue.trim()
    setInputValue('')
    setError(null)

    try {
      await sendMessage(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFindConnections = async () => {
    setError(null)
    try {
      const count = await findConnections()
      if (count > 0) {
        setActiveTab('suggestions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find connections')
    }
  }

  const handleGenerateIdeas = async () => {
    setError(null)
    try {
      const count = await generateIdeas()
      if (count > 0) {
        setActiveTab('suggestions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate ideas')
    }
  }

  const handleCritiqueIdeas = async () => {
    setError(null)
    try {
      const count = await critiqueIdeas()
      if (count > 0) {
        setActiveTab('suggestions')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to critique ideas')
    }
  }

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { id: 'suggestions' as const, label: 'Suggestions', icon: Lightbulb, count: aiSuggestions.length },
  ]

  const canFindConnections = currentMoodboard && currentMoodboard.nodes.length >= 2
  const canGenerateIdeas = currentMoodboard && currentMoodboard.nodes.length >= 1
  const canCritique = currentMoodboard && selection.nodeIds.length >= 1

  return (
    <div className="w-80 h-full flex flex-col">
      {/* Header */}
      <div className="p-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: COLORS.primaryGlow }}
          >
            <Sparkles size={16} style={{ color: COLORS.primary }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: COLORS.text }}>AI Assistant</h3>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              {isReady ? 'Brainstorm with AI' : 'Claude Code not ready'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: `${COLORS.surface}80` }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: activeTab === tab.id ? COLORS.surface : 'transparent',
                color: activeTab === tab.id ? COLORS.text : COLORS.textMuted,
              }}
            >
              <tab.icon size={12} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="px-1.5 py-0.5 text-[10px] rounded-full"
                  style={{
                    backgroundColor: COLORS.primaryGlow,
                    color: COLORS.primary,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="mx-4 mt-2 p-2 rounded-lg flex items-center gap-2"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
        >
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={12} className="text-red-400" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto" ref={chatContainerRef}>
        <AnimatePresence mode="wait">
          {activeTab === 'chat' ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="p-4"
            >
              {/* Selection context */}
              {selectedNodes.length > 0 && (
                <div
                  className="mb-4 p-3 rounded-lg"
                  style={{
                    backgroundColor: `${COLORS.surface}80`,
                    border: `1px solid ${COLORS.border}30`,
                  }}
                >
                  <p className="text-xs mb-2" style={{ color: COLORS.textMuted }}>
                    {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNodes.slice(0, 3).map((node) => (
                      <span
                        key={node.id}
                        className="px-2 py-0.5 text-xs rounded"
                        style={{
                          backgroundColor: COLORS.primaryGlow,
                          color: COLORS.primary,
                        }}
                      >
                        {node.title || 'Untitled'}
                      </span>
                    ))}
                    {selectedNodes.length > 3 && (
                      <span
                        className="px-2 py-0.5 text-xs rounded"
                        style={{
                          backgroundColor: COLORS.surface,
                          color: COLORS.textMuted,
                        }}
                      >
                        +{selectedNodes.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="space-y-2 mb-4">
                <p className="text-xs uppercase tracking-wider" style={{ color: COLORS.textDim }}>Quick Actions</p>
                <button
                  onClick={handleFindConnections}
                  disabled={!isReady || !canFindConnections || isProcessing}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: `${COLORS.surface}80` }}
                  title={!canFindConnections ? 'Need at least 2 nodes' : 'Find semantic relationships between ideas'}
                >
                  {isProcessing ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: COLORS.primary }} />
                  ) : (
                    <Link2 size={14} style={{ color: COLORS.primary }} />
                  )}
                  <span className="text-sm" style={{ color: COLORS.text }}>Find connections</span>
                </button>
                <button
                  onClick={handleGenerateIdeas}
                  disabled={!isReady || !canGenerateIdeas || isProcessing}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: `${COLORS.surface}80` }}
                  title={!canGenerateIdeas ? 'Need at least 1 node' : 'Brainstorm related concepts'}
                >
                  {isProcessing ? (
                    <Loader2 size={14} className="animate-spin text-amber-400" />
                  ) : (
                    <Lightbulb size={14} className="text-amber-400" />
                  )}
                  <span className="text-sm" style={{ color: COLORS.text }}>Generate related ideas</span>
                </button>
                <button
                  onClick={handleCritiqueIdeas}
                  disabled={!isReady || !canCritique || isProcessing}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: `${COLORS.surface}80` }}
                  title={!canCritique ? 'Select at least 1 node to critique' : 'Get devil\'s advocate feedback'}
                >
                  {isProcessing ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: COLORS.aiSuggestion }} />
                  ) : (
                    <MessageSquare size={14} style={{ color: COLORS.aiSuggestion }} />
                  )}
                  <span className="text-sm" style={{ color: COLORS.text }}>Critique my ideas</span>
                </button>
              </div>

              {/* Chat messages */}
              {chatMessages.length > 0 ? (
                <div className="space-y-3">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${message.role === 'user' ? 'ml-4' : 'mr-4'}`}
                      style={{
                        backgroundColor: message.role === 'user' ? COLORS.primaryGlow : `${COLORS.surface}80`,
                        border: `1px solid ${message.role === 'user' ? COLORS.primary : COLORS.border}30`,
                      }}
                    >
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>
                        {message.role === 'user' ? 'You' : 'AI'}
                      </p>
                      <p
                        className="text-sm whitespace-pre-wrap"
                        style={{ color: COLORS.text }}
                      >
                        {message.content || (message.isStreaming ? '...' : '')}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty state / placeholder */
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: COLORS.surface }}
                  >
                    <Sparkles size={20} style={{ color: COLORS.textDim }} />
                  </div>
                  <p className="text-sm" style={{ color: COLORS.textMuted }}>
                    {isReady ? (
                      <>
                        Ask me to help brainstorm,
                        <br />
                        find patterns, or critique ideas
                      </>
                    ) : (
                      <>
                        Install Claude Code to use AI features.
                        <br />
                        <a
                          href="https://docs.anthropic.com/en/docs/claude-code"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                          style={{ color: COLORS.primary }}
                        >
                          Download Claude Code
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="suggestions"
              variants={staggerContainerVariants}
              initial="initial"
              animate="animate"
              className="p-4 space-y-3"
            >
              {aiSuggestions.length === 0 ? (
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: COLORS.surface }}
                  >
                    <Lightbulb size={20} style={{ color: COLORS.textDim }} />
                  </div>
                  <p className="text-sm" style={{ color: COLORS.textMuted }}>
                    No suggestions yet
                  </p>
                  <p className="text-xs mt-1" style={{ color: COLORS.textDim }}>
                    Use Quick Actions to generate AI suggestions
                  </p>
                </div>
              ) : (
                aiSuggestions.map((suggestion) => (
                  <motion.div
                    key={suggestion.data.id}
                    variants={staggerItemVariants}
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: `${COLORS.surface}80`,
                      border: `1px solid ${COLORS.border}30`,
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {suggestion.type === 'connection' ? (
                        <Link2 size={14} className="mt-0.5" style={{ color: COLORS.primary }} />
                      ) : suggestion.type === 'node' ? (
                        <Lightbulb size={14} className="text-amber-400 mt-0.5" />
                      ) : (
                        <MessageSquare size={14} className="mt-0.5" style={{ color: COLORS.aiSuggestion }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>
                          {suggestion.type === 'connection'
                            ? 'Connection'
                            : suggestion.type === 'node'
                            ? 'New Idea'
                            : 'Critique'}
                        </p>
                        <p className="text-sm" style={{ color: COLORS.text }}>
                          {suggestion.type === 'connection'
                            ? suggestion.data.reasoning
                            : suggestion.type === 'node'
                            ? suggestion.data.title
                            : suggestion.data.critique}
                        </p>
                        {suggestion.type === 'node' && suggestion.data.content && (
                          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                            {suggestion.data.content}
                          </p>
                        )}
                        {suggestion.type === 'critique' && suggestion.data.suggestions?.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {suggestion.data.suggestions.map((s, i) => (
                              <li key={i} className="text-xs flex items-start gap-1" style={{ color: COLORS.textMuted }}>
                                <span>•</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {suggestion.type === 'connection' && (
                          <div className="flex items-center gap-1 mt-1">
                            <span
                              className="px-1.5 py-0.5 text-[10px] rounded"
                              style={{
                                backgroundColor: COLORS.primaryGlow,
                                color: COLORS.primary,
                              }}
                            >
                              {Math.round(suggestion.data.confidence * 100)}% confidence
                            </span>
                          </div>
                        )}
                        {suggestion.type === 'critique' && (
                          <div className="flex items-center gap-1 mt-1">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] rounded ${
                                suggestion.data.severity === 'critical'
                                  ? 'bg-red-500/20 text-red-400'
                                  : suggestion.data.severity === 'warning'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}
                            >
                              {suggestion.data.severity}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => removeAISuggestion(suggestion.data.id)}
                        className="p-1.5 rounded transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: `${COLORS.surface}80`,
                          color: COLORS.textMuted,
                        }}
                        title="Dismiss"
                      >
                        <X size={14} />
                      </button>
                      <button
                        onClick={() => acceptAISuggestion(suggestion.data.id)}
                        className="p-1.5 rounded transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: COLORS.aiSuggestionGlow,
                          color: COLORS.aiSuggestion,
                        }}
                        title="Accept"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      {activeTab === 'chat' && (
        <div className="p-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <div className="flex gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isReady ? 'Ask AI for help...' : 'Claude Code not ready'}
              disabled={!isReady || isProcessing}
              rows={1}
              className="flex-1 px-3 py-2 rounded-lg text-sm resize-none focus:outline-none disabled:opacity-50"
              style={{
                backgroundColor: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing || !isReady}
              className="px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: COLORS.primary }}
            >
              {isProcessing ? (
                <Loader2 size={16} className="animate-spin" style={{ color: COLORS.text }} />
              ) : (
                <Send size={16} style={{ color: COLORS.text }} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
