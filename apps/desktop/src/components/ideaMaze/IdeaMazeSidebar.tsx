import { useState } from 'react'
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
} from 'lucide-react'
import { useIdeaMazeStore } from '../../stores/ideaMazeStore'
import {
  staggerContainerVariants,
  staggerItemVariants,
  COLORS,
} from '../../lib/ideaMaze/animations'

type TabId = 'chat' | 'suggestions'

export function IdeaMazeSidebar() {
  const [activeTab, setActiveTab] = useState<TabId>('chat')
  const [inputValue, setInputValue] = useState('')
  const {
    aiSuggestions,
    isAIProcessing,
    selection,
    currentMoodboard,
    acceptAISuggestion,
    removeAISuggestion,
  } = useIdeaMazeStore()

  const selectedNodes = currentMoodboard?.nodes.filter((n) =>
    selection.nodeIds.includes(n.id)
  ) || []

  /* TODO: AI Chat - Implementation needed
   * Expected behavior:
   * 1. Send user message to AI service with context of:
   *    - Currently selected nodes (content, titles, tags)
   *    - Overall moodboard context (all nodes and connections)
   *    - Conversation history for multi-turn chat
   * 2. Display AI response in a chat message list
   * 3. Support different types of AI actions:
   *    - "Find connections" - Analyze and suggest relationships between ideas
   *    - "Generate related ideas" - Create new node suggestions based on selection
   *    - "Critique my ideas" - Provide critical analysis and identify gaps
   *
   * Implementation approach:
   * - Add a messages state array: { role: 'user' | 'assistant', content: string }[]
   * - Use setAIProcessing(true) while waiting for response
   * - Call AI service (Claude API) with structured prompt
   * - Parse response for any actionable items (new nodes, connections)
   * - Render messages in scrollable chat view
   *
   * Considerations:
   * - Add message streaming for better UX
   * - Persist chat history per moodboard
   * - Allow AI to directly modify the canvas (with user confirmation)
   * - Handle context length limits by summarizing older messages
   * - Add "thinking" indicator while AI processes
   */
  const handleSendMessage = () => {
    if (!inputValue.trim()) return
    // TODO: Implement AI chat - see comment above for implementation details
    setInputValue('')
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

              {/* Quick actions - TODO: Implementation needed for all three buttons
               *
               * "Find connections" button:
               * - Analyze selected nodes (or all nodes) to find semantic relationships
               * - Use AI to identify nodes that should be connected but aren't
               * - Generate ConnectionSuggestion items with confidence scores and reasoning
               * - Add suggestions via addAISuggestion({ type: 'connection', data: ... })
               *
               * "Generate related ideas" button:
               * - Take selected nodes as context/seed ideas
               * - Use AI to brainstorm related concepts, alternatives, or extensions
               * - Generate NodeSuggestion items with suggested positions and content
               * - Position new suggestions near related existing nodes
               * - Add suggestions via addAISuggestion({ type: 'node', data: ... })
               *
               * "Critique my ideas" button:
               * - Analyze selected nodes for logical gaps, contradictions, assumptions
               * - Use AI to provide devil's advocate feedback
               * - Generate CritiqueSuggestion items with severity levels
               * - Highlight potential weaknesses and suggest improvements
               * - Add suggestions via addAISuggestion({ type: 'critique', data: ... })
               *
               * All buttons should:
               * - Show loading state (setAIProcessing(true)) while processing
               * - Handle errors gracefully with toast notifications
               * - Automatically switch to Suggestions tab after generating results
               */}
              <div className="space-y-2 mb-4">
                <p className="text-xs uppercase tracking-wider" style={{ color: COLORS.textDim }}>Quick Actions</p>
                <button
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors hover:opacity-80 opacity-50 cursor-not-allowed"
                  style={{ backgroundColor: `${COLORS.surface}80` }}
                  disabled
                  title="Coming soon"
                >
                  <Link2 size={14} style={{ color: COLORS.primary }} />
                  <span className="text-sm" style={{ color: COLORS.text }}>Find connections</span>
                </button>
                <button
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors hover:opacity-80 opacity-50 cursor-not-allowed"
                  style={{ backgroundColor: `${COLORS.surface}80` }}
                  disabled
                  title="Coming soon"
                >
                  <Lightbulb size={14} className="text-amber-400" />
                  <span className="text-sm" style={{ color: COLORS.text }}>Generate related ideas</span>
                </button>
                <button
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors hover:opacity-80 opacity-50 cursor-not-allowed"
                  style={{ backgroundColor: `${COLORS.surface}80` }}
                  disabled
                  title="Coming soon"
                >
                  <MessageSquare size={14} style={{ color: COLORS.aiSuggestion }} />
                  <span className="text-sm" style={{ color: COLORS.text }}>Critique my ideas</span>
                </button>
              </div>

              {/* Chat placeholder */}
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
              disabled={!inputValue.trim() || isAIProcessing}
              className="px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: COLORS.primary }}
            >
              {isAIProcessing ? (
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
