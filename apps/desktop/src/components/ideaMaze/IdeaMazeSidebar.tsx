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
import { useSettingsStore } from '../../stores/settingsStore'
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    aiSuggestions,
    selection,
    currentMoodboard,
    acceptAISuggestion,
    removeAISuggestion,
  } = useIdeaMazeStore()

  const { agentStatuses, checkAgentStatus, isCheckingAgent } = useSettingsStore()

  const {
    chatMessages,
    isProcessing,
    sendMessage,
    findConnections,
    generateIdeas,
    critiqueIdeas,
    isReady,
  } = useIdeaMazeChat()

  // Check Claude Code status on mount if not already checked
  useEffect(() => {
    const claudeStatus = agentStatuses['claude-code']
    if (!claudeStatus && !isCheckingAgent) {
      checkAgentStatus('claude-code')
    }
  }, [agentStatuses, checkAgentStatus, isCheckingAgent])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const selectedNodes = currentMoodboard?.nodes.filter((n) =>
    selection.nodeIds.includes(n.id)
  ) || []

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return
    setError(null)
    const message = inputValue
    setInputValue('')
    try {
      await sendMessage(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    }
  }

  const handleFindConnections = async () => {
    if (isProcessing) return
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
    if (isProcessing) return
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
    if (isProcessing) return
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { id: 'suggestions' as const, label: 'Suggestions', icon: Lightbulb, count: aiSuggestions.length },
  ]

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
            <p className="text-xs" style={{ color: COLORS.textMuted }}>Brainstorm with AI</p>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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

              {/* Error display */}
              {error && (
                <div
                  className="mb-4 p-3 rounded-lg flex items-start gap-2"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Status warning */}
              {isCheckingAgent && (
                <div
                  className="mb-4 p-3 rounded-lg flex items-start gap-2"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <Loader2 size={14} className="text-blue-400 mt-0.5 flex-shrink-0 animate-spin" />
                  <p className="text-xs text-blue-400">
                    Checking Claude Code status...
                  </p>
                </div>
              )}
              {!isReady && !isCheckingAgent && (
                <div
                  className="mb-4 p-3 rounded-lg flex items-start gap-2"
                  style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                  }}
                >
                  <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-400">
                    Claude Code not ready. Install and authenticate to use AI features.
                  </p>
                </div>
              )}

              {/* Quick actions */}
              <div className="space-y-2 mb-4">
                <p className="text-xs uppercase tracking-wider" style={{ color: COLORS.textDim }}>Quick Actions</p>
                <button
                  onClick={handleFindConnections}
                  disabled={!isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length < 2}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                    !isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length < 2
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:opacity-80 cursor-pointer'
                  }`}
                  style={{ backgroundColor: `${COLORS.surface}80` }}
                  title={!isReady ? 'Claude Code not ready' : currentMoodboard && currentMoodboard.nodes.length < 2 ? 'Need at least 2 nodes' : 'Find connections between ideas'}
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
                  disabled={!isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length === 0}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                    !isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:opacity-80 cursor-pointer'
                  }`}
                  style={{ backgroundColor: `${COLORS.surface}80` }}
                  title={!isReady ? 'Claude Code not ready' : 'Generate related ideas'}
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
                  disabled={!isReady || isProcessing || selection.nodeIds.length === 0}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                    !isReady || isProcessing || selection.nodeIds.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:opacity-80 cursor-pointer'
                  }`}
                  style={{ backgroundColor: `${COLORS.surface}80` }}
                  title={!isReady ? 'Claude Code not ready' : selection.nodeIds.length === 0 ? 'Select nodes to critique' : 'Critique selected ideas'}
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
              {chatMessages.length === 0 ? (
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: COLORS.surface }}
                  >
                    <Sparkles size={20} style={{ color: COLORS.textDim }} />
                  </div>
                  <p className="text-sm" style={{ color: COLORS.textMuted }}>
                    Ask me to help brainstorm,
                    <br />
                    find patterns, or critique ideas
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg ${msg.role === 'user' ? 'ml-4' : 'mr-4'}`}
                      style={{
                        backgroundColor: msg.role === 'user'
                          ? COLORS.primaryGlow
                          : `${COLORS.surface}80`,
                        border: `1px solid ${msg.role === 'user' ? COLORS.primary : COLORS.border}30`,
                      }}
                    >
                      <p className="text-xs mb-1 uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
                        {msg.role === 'user' ? 'You' : 'AI'}
                      </p>
                      <p
                        className="text-sm whitespace-pre-wrap"
                        style={{ color: COLORS.text }}
                      >
                        {msg.content}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                        )}
                      </p>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
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
                    Select nodes and ask AI for analysis
                  </p>
                </div>
              ) : (
                aiSuggestions.map((suggestion) => (
                  <motion.div
                    key={suggestion.type === 'connection' ? suggestion.data.id : suggestion.data.id}
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
              placeholder="Ask AI for help..."
              rows={1}
              className="flex-1 px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
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
