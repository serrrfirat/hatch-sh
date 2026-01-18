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
  ClipboardList,
  ChevronLeft,
  MessageCircle,
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

/**
 * Clean up message content for display by removing JSON blocks
 */
function cleanMessageContent(content: string): string {
  // Remove ```question blocks (interview questions)
  let cleaned = content.replace(/```question\s*[\s\S]*?```/g, '')
  // Remove ```plan blocks (final plan output)
  cleaned = cleaned.replace(/```plan\s*[\s\S]*?```/g, '')
  // Trim whitespace and remove excessive newlines
  cleaned = cleaned.trim().replace(/\n{3,}/g, '\n\n')
  return cleaned
}

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
    startInterview,
    startMoodboardInterview,
    cancelInterview,
    selectOption,
    submitMultipleOptions,
    currentQuestion,
    currentOptions,
    isMultiSelect,
    isReady,
    isInterviewing,
  } = useIdeaMazeChat()

  // Track selected options for multi-select mode
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])

  // Check Claude Code status on mount if not already checked
  useEffect(() => {
    const claudeStatus = agentStatuses['claude-code']
    if (!claudeStatus && !isCheckingAgent) {
      checkAgentStatus('claude-code')
    }
  }, [agentStatuses, checkAgentStatus, isCheckingAgent])

  // Clear selected options when new question arrives
  useEffect(() => {
    setSelectedOptions([])
  }, [currentOptions])

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

  const handleStartInterview = async () => {
    if (isProcessing) return
    setError(null)
    try {
      await startInterview()
      // Stay on chat tab for the interview conversation
      setActiveTab('chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview')
    }
  }

  const handleStartMoodboardInterview = async () => {
    if (isProcessing) return
    setError(null)
    try {
      await startMoodboardInterview()
      // Stay on chat tab for the interview conversation
      setActiveTab('chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start interview')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSelectOption = async (option: string) => {
    if (isProcessing) return
    setError(null)

    if (isMultiSelect) {
      // Toggle selection for multi-select mode
      setSelectedOptions(prev =>
        prev.includes(option)
          ? prev.filter(o => o !== option)
          : [...prev, option]
      )
    } else {
      // Single select - send immediately
      try {
        await selectOption(option)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send response')
      }
    }
  }

  const handleSubmitMultiSelect = async () => {
    if (isProcessing || selectedOptions.length === 0) return
    setError(null)
    try {
      await submitMultipleOptions(selectedOptions)
      setSelectedOptions([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send response')
    }
  }

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    { id: 'suggestions' as const, label: 'Suggestions', icon: Lightbulb, count: aiSuggestions.length },
  ]

  // Interview Mode: Chat Flow Design
  if (isInterviewing) {
    return (
      <div className="w-80 h-full flex flex-col" style={{ backgroundColor: COLORS.backgroundAlt }}>
        {/* Compact Interview Header */}
        <div
          className="p-4 flex items-center gap-3"
          style={{ borderBottom: `1px solid ${COLORS.border}30` }}
        >
          <button
            onClick={cancelInterview}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: COLORS.textMuted }}
            title="Exit interview"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h3 className="text-sm font-semibold" style={{ color: COLORS.text }}>
              Plan Interview
            </h3>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              Refining your ideas
            </p>
          </div>
          {isProcessing ? (
            <Loader2 size={14} className="animate-spin text-emerald-400" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>

        {/* Chat Area - Bubble Style */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.map((msg) => {
            const displayContent = msg.role === 'assistant'
              ? cleanMessageContent(msg.content)
              : msg.content

            if (!displayContent && !msg.isStreaming && msg.role === 'assistant') {
              return null
            }

            return (
              <div
                key={msg.id}
                className={msg.role === 'user' ? 'pl-8' : 'pr-8'}
              >
                <div
                  className={`p-3 text-sm ${
                    msg.role === 'user'
                      ? 'rounded-2xl rounded-tr-md'
                      : 'rounded-2xl rounded-tl-md'
                  }`}
                  style={{
                    backgroundColor: msg.role === 'user'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : COLORS.surface,
                    border: msg.role === 'user'
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : 'none',
                  }}
                >
                  <p className="whitespace-pre-wrap" style={{ color: COLORS.text }}>
                    {displayContent}
                    {msg.isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-emerald-400 animate-pulse" />
                    )}
                  </p>
                </div>
              </div>
            )
          })}

          {/* Options as Bubble Buttons */}
          {currentOptions && currentOptions.length > 0 && !isProcessing && (
            <div className="pl-8 space-y-2">
              {currentQuestion && (
                <p className="text-xs font-medium mb-3" style={{ color: '#10b981' }}>
                  {currentQuestion}
                </p>
              )}
              {isMultiSelect && (
                <p className="text-[10px] mb-2" style={{ color: COLORS.textMuted }}>
                  Select all that apply
                </p>
              )}
              {currentOptions.map((option, idx) => {
                const isSelected = selectedOptions.includes(option)
                return (
                  <motion.button
                    key={idx}
                    onClick={() => handleSelectOption(option)}
                    disabled={isProcessing}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full p-3 rounded-2xl rounded-tr-md text-left text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    style={{
                      backgroundColor: isMultiSelect && isSelected
                        ? 'rgba(16, 185, 129, 0.25)'
                        : 'rgba(16, 185, 129, 0.08)',
                      border: isMultiSelect && isSelected
                        ? '1px solid rgba(16, 185, 129, 0.5)'
                        : '1px solid rgba(16, 185, 129, 0.2)',
                      color: COLORS.text,
                    }}
                  >
                    {isMultiSelect && (
                      <span
                        className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: isSelected ? '#10b981' : 'rgba(16, 185, 129, 0.4)',
                          backgroundColor: isSelected ? '#10b981' : 'transparent',
                        }}
                      >
                        {isSelected && <Check size={12} className="text-white" />}
                      </span>
                    )}
                    <span>{option}</span>
                  </motion.button>
                )
              })}
              {isMultiSelect && (
                <motion.button
                  onClick={handleSubmitMultiSelect}
                  disabled={isProcessing || selectedOptions.length === 0}
                  whileHover={{ scale: selectedOptions.length > 0 ? 1.01 : 1 }}
                  whileTap={{ scale: selectedOptions.length > 0 ? 0.99 : 1 }}
                  className="w-full p-3 rounded-2xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  style={{
                    backgroundColor: selectedOptions.length > 0 ? '#10b981' : 'rgba(16, 185, 129, 0.2)',
                    color: selectedOptions.length > 0 ? 'white' : COLORS.textMuted,
                  }}
                >
                  Continue{selectedOptions.length > 0 ? ` (${selectedOptions.length} selected)` : ''}
                </motion.button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4" style={{ borderTop: `1px solid ${COLORS.border}30` }}>
          <div
            className="flex items-center gap-2 p-2 rounded-xl"
            style={{ backgroundColor: COLORS.surface }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type something else..."
              className="flex-1 bg-transparent px-2 text-sm focus:outline-none"
              style={{ color: COLORS.text }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              className="p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: inputValue.trim() ? '#10b981' : COLORS.backgroundAlt,
              }}
            >
              {isProcessing ? (
                <Loader2 size={16} className="animate-spin" style={{ color: COLORS.text }} />
              ) : (
                <Send size={16} style={{ color: COLORS.text }} />
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Normal Mode: Monochrome Glassmorphism Style
  return (
    <div
      className="w-80 h-full flex flex-col"
      style={{
        background: 'rgba(18, 18, 18, 0.85)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
      }}
    >
      {/* Header */}
      <div
        className="p-4"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">AI Assistant</h3>
            <p className="text-xs text-neutral-500">Brainstorm with AI</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeTab === tab.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: activeTab === tab.id ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                color: activeTab === tab.id ? '#fff' : 'rgba(255, 255, 255, 0.4)',
              }}
            >
              <tab.icon size={12} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="px-1.5 py-0.5 text-[10px] rounded-full"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#fff',
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
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <p className="text-xs mb-2 text-neutral-500">
                    {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNodes.slice(0, 3).map((node) => (
                      <span
                        key={node.id}
                        className="px-2 py-0.5 text-xs rounded"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          color: 'rgba(255, 255, 255, 0.8)',
                        }}
                      >
                        {node.title || 'Untitled'}
                      </span>
                    ))}
                    {selectedNodes.length > 3 && (
                      <span
                        className="px-2 py-0.5 text-xs rounded"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: 'rgba(255, 255, 255, 0.5)',
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
                    border: '1px solid rgba(239, 68, 68, 0.2)',
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
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Loader2 size={14} className="text-neutral-400 mt-0.5 flex-shrink-0 animate-spin" />
                  <p className="text-xs text-neutral-400">
                    Checking Claude Code status...
                  </p>
                </div>
              )}
              {!isReady && !isCheckingAgent && (
                <div
                  className="mb-4 p-3 rounded-lg flex items-start gap-2"
                  style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                  }}
                >
                  <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-400">
                    Claude Code not ready. Install and authenticate to use AI features.
                  </p>
                </div>
              )}

              {/* Quick actions */}
              <div className="space-y-1.5 mb-6">
                <p className="text-[10px] uppercase tracking-wider text-neutral-600 mb-2">Quick Actions</p>
                <button
                  onClick={handleFindConnections}
                  disabled={!isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length < 2}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    !isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length < 2
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-white/5'
                  }`}
                  title={!isReady ? 'Claude Code not ready' : currentMoodboard && currentMoodboard.nodes.length < 2 ? 'Need at least 2 nodes' : 'Find connections between ideas'}
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin text-white" />
                  ) : (
                    <Link2 size={16} className="text-white" />
                  )}
                  <span className="text-sm text-neutral-400">Find connections</span>
                </button>
                <button
                  onClick={handleGenerateIdeas}
                  disabled={!isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length === 0}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    !isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-white/5'
                  }`}
                  title={!isReady ? 'Claude Code not ready' : 'Generate related ideas'}
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin text-amber-400" />
                  ) : (
                    <Lightbulb size={16} className="text-amber-400" />
                  )}
                  <span className="text-sm text-neutral-400">Generate related ideas</span>
                </button>
                <button
                  onClick={handleCritiqueIdeas}
                  disabled={!isReady || isProcessing || selection.nodeIds.length === 0}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    !isReady || isProcessing || selection.nodeIds.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-white/5'
                  }`}
                  title={!isReady ? 'Claude Code not ready' : selection.nodeIds.length === 0 ? 'Select nodes to critique' : 'Critique selected ideas'}
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin text-purple-400" />
                  ) : (
                    <MessageSquare size={16} className="text-purple-400" />
                  )}
                  <span className="text-sm text-neutral-400">Critique my ideas</span>
                </button>
                <button
                  onClick={handleStartInterview}
                  disabled={!isReady || isProcessing || selection.nodeIds.length === 0}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    !isReady || isProcessing || selection.nodeIds.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-white/5'
                  }`}
                  title={!isReady ? 'Claude Code not ready' : selection.nodeIds.length === 0 ? 'Select ideas to create a plan' : 'Interview to create a plan'}
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin text-emerald-400" />
                  ) : (
                    <ClipboardList size={16} className="text-emerald-400" />
                  )}
                  <span className="text-sm text-neutral-400">Create a plan</span>
                </button>
                <button
                  onClick={handleStartMoodboardInterview}
                  disabled={!isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length === 0}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    !isReady || isProcessing || !currentMoodboard || currentMoodboard.nodes.length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-white/5'
                  }`}
                  title={!isReady ? 'Claude Code not ready' : !currentMoodboard || currentMoodboard.nodes.length === 0 ? 'Add ideas first' : 'Create a plan from all ideas on the moodboard'}
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin text-emerald-400/70" />
                  ) : (
                    <ClipboardList size={16} className="text-emerald-400/70" />
                  )}
                  <span className="text-sm text-neutral-400">Create a plan with all ideas</span>
                </button>
              </div>

              {/* Chat messages */}
              {chatMessages.length === 0 ? (
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <Sparkles size={20} className="text-neutral-500" />
                  </div>
                  <p className="text-sm text-neutral-500">
                    Ask me to help brainstorm,
                    <br />
                    find patterns, or critique ideas
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((msg) => {
                    // Clean up the message content for display
                    const displayContent = msg.role === 'assistant'
                      ? cleanMessageContent(msg.content)
                      : msg.content

                    // Skip rendering if there's no content after cleaning (unless streaming)
                    if (!displayContent && !msg.isStreaming && msg.role === 'assistant') {
                      return null
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${msg.role === 'user' ? 'ml-4' : 'mr-4'}`}
                        style={{
                          backgroundColor: msg.role === 'user'
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(255, 255, 255, 0.05)',
                          border: msg.role === 'user'
                            ? '1px solid rgba(255, 255, 255, 0.15)'
                            : '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <p className="text-xs mb-1 uppercase tracking-wider text-neutral-600">
                          {msg.role === 'user' ? 'You' : 'AI'}
                        </p>
                        <p className="text-sm whitespace-pre-wrap text-neutral-300">
                          {displayContent}
                          {msg.isStreaming && (
                            <span className="inline-block w-2 h-4 ml-1 bg-white/50 animate-pulse" />
                          )}
                        </p>
                      </div>
                    )
                  })}

                  {/* Multiple choice options for interview */}
                  {isInterviewing && currentOptions && currentOptions.length > 0 && !isProcessing && (
                    <div
                      className="p-3 rounded-lg space-y-2"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      {currentQuestion && (
                        <p className="text-xs font-medium mb-2 text-neutral-400">
                          {currentQuestion}
                        </p>
                      )}
                      {isMultiSelect && (
                        <p className="text-[10px] mb-2 text-neutral-600">
                          Select all that apply
                        </p>
                      )}
                      {currentOptions.map((option, idx) => {
                        const isSelected = selectedOptions.includes(option)
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectOption(option)}
                            disabled={isProcessing}
                            className="w-full p-2.5 rounded-lg text-left text-sm transition-all hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            style={{
                              backgroundColor: isMultiSelect && isSelected
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(255, 255, 255, 0.05)',
                              border: isMultiSelect && isSelected
                                ? '1px solid rgba(255, 255, 255, 0.2)'
                                : '1px solid rgba(255, 255, 255, 0.08)',
                              color: '#e5e5e5',
                            }}
                          >
                            {isMultiSelect && (
                              <span
                                className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                                style={{
                                  borderColor: isSelected ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                                }}
                              >
                                {isSelected && (
                                  <Check size={12} className="text-white" />
                                )}
                              </span>
                            )}
                            <span>{option}</span>
                          </button>
                        )
                      })}
                      {isMultiSelect && (
                        <button
                          onClick={handleSubmitMultiSelect}
                          disabled={isProcessing || selectedOptions.length === 0}
                          className="w-full p-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                          style={{
                            backgroundColor: selectedOptions.length > 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: selectedOptions.length > 0 ? 'white' : 'rgba(255, 255, 255, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                          }}
                        >
                          Continue{selectedOptions.length > 0 ? ` (${selectedOptions.length} selected)` : ''}
                        </button>
                      )}
                      <p className="text-[10px] mt-2 text-neutral-600">
                        Or type your own answer below
                      </p>
                    </div>
                  )}

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
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <Lightbulb size={20} className="text-neutral-500" />
                  </div>
                  <p className="text-sm text-neutral-500">
                    No suggestions yet
                  </p>
                  <p className="text-xs mt-1 text-neutral-600">
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
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {suggestion.type === 'connection' ? (
                        <Link2 size={14} className="mt-0.5 text-white" />
                      ) : suggestion.type === 'node' ? (
                        <Lightbulb size={14} className="text-amber-400 mt-0.5" />
                      ) : (
                        <MessageSquare size={14} className="mt-0.5 text-purple-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs uppercase tracking-wider mb-1 text-neutral-600">
                          {suggestion.type === 'connection'
                            ? 'Connection'
                            : suggestion.type === 'node'
                            ? 'New Idea'
                            : 'Critique'}
                        </p>
                        <p className="text-sm text-neutral-300">
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
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                color: 'rgba(255, 255, 255, 0.7)',
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
                        className="p-1.5 rounded transition-colors hover:bg-white/5"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: 'rgba(255, 255, 255, 0.5)',
                        }}
                      >
                        <X size={14} />
                      </button>
                      <button
                        onClick={() => acceptAISuggestion(suggestion.data.id)}
                        className="p-1.5 rounded transition-colors hover:opacity-90"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
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
        <div
          className="p-3"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}
        >
          <div
            className="flex items-center gap-2 p-2 rounded-xl"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI for help..."
              className="flex-1 bg-transparent px-2 text-sm focus:outline-none text-neutral-300 placeholder:text-neutral-600"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing || !isReady}
              className="p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
              style={{
                backgroundColor: inputValue.trim() ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              }}
            >
              {isProcessing ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <Send size={16} className="text-white" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
