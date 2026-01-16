/**
 * useIdeaMazeChat - AI Assistant hook for Idea Maze
 *
 * Thin wrapper around the Claude Code bridge for Idea Maze specific AI interactions.
 * Reuses the same streaming infrastructure as useChat.ts
 */

import { useCallback, useRef } from 'react'
import { useIdeaMazeStore } from '../stores/ideaMazeStore'
import { useSettingsStore } from '../stores/settingsStore'
import { sendToClaudeCodeStreaming, type StreamEvent } from '../lib/claudeCode/bridge'
import type { AISuggestion, ConnectionSuggestion, NodeSuggestion, CritiqueSuggestion, IdeaNode, IdeaConnection, SelectionState, Position } from '../lib/ideaMaze/types'

// System prompt for AI Assistant
const SYSTEM_PROMPT = `You are an AI assistant helping brainstorm and analyze ideas on a visual canvas called Idea Maze.
You can see the user's idea nodes and their connections.

When the user asks for analysis or suggestions, be specific and actionable.
When generating structured suggestions (connections, ideas, critiques), output them as JSON in a code block.

Be concise but insightful. Focus on finding non-obvious patterns and connections.`

// Quick Action prompts (from existing skills)
const FIND_CONNECTIONS_PROMPT = `Analyze these ideas to find meaningful relationships not yet connected.

Use multi-angle synthesis:
1. Semantic relationships - ideas that discuss similar concepts
2. Causal relationships - ideas where one leads to or depends on another
3. Contradictions - ideas that conflict or present opposing views
4. Extensions - ideas that build upon or elaborate others
5. Alternatives - ideas that solve the same problem differently

For each connection found, respond with a JSON code block containing an array:
\`\`\`json
[
  {
    "sourceId": "node-id-1",
    "targetId": "node-id-2",
    "relationship": "related|depends-on|contradicts|extends|alternative",
    "confidence": 0.85,
    "reasoning": "Why this connection matters"
  }
]
\`\`\``

const GENERATE_IDEAS_PROMPT = `Based on the selected ideas, brainstorm related concepts using these frameworks:

1. **Extensions**: What naturally follows from these ideas?
2. **Alternatives**: What other approaches could achieve the same goal?
3. **Prerequisites**: What needs to be true for these ideas to work?
4. **Implications**: What are the downstream effects?
5. **Adjacent spaces**: What related problems could be solved?

Generate 2-4 new ideas. Respond with a JSON code block:
\`\`\`json
[
  {
    "title": "Concise idea name",
    "content": "1-2 sentence description",
    "reasoning": "Why this relates to selected ideas",
    "relatedToNodeId": "existing-node-id"
  }
]
\`\`\``

const CRITIQUE_PROMPT = `Critically analyze these ideas using the Devil's Advocate framework:

**Perspective Analysis:**
- Skeptic: What assumptions are being made? Are they valid?
- Pessimist: What could go wrong? What's the worst case?
- Competitor: How could someone exploit weaknesses?
- User: Would real users actually want this?
- Maintainer: What happens 6 months from now?

**Gap Analysis:**
- Scope gaps: What's not addressed that should be?
- Edge cases: What unusual scenarios aren't handled?
- Dependencies: What external factors could break this?
- Blind spots: What biases might be affecting this?
- Alternatives: What other approaches weren't considered?

Respond with a JSON code block containing critiques:
\`\`\`json
[
  {
    "nodeId": "node-being-critiqued",
    "critique": "The specific concern",
    "suggestions": ["Improvement idea 1", "Improvement idea 2"],
    "severity": "info|warning|critical"
  }
]
\`\`\``

/**
 * Build context string from moodboard state
 */
function buildMoodboardContext(
  nodes: IdeaNode[],
  connections: IdeaConnection[],
  selection: SelectionState
): string {
  const selectedNodes = nodes.filter(n => selection.nodeIds.includes(n.id))
  const selectedNodeIds = new Set(selection.nodeIds)

  let context = '\n\nCurrent moodboard context:\n'

  // List all nodes
  context += '\n**All Nodes:**\n'
  for (const node of nodes) {
    const isSelected = selectedNodeIds.has(node.id)
    const title = node.title || 'Untitled'
    const textContent = node.content.find(c => c.type === 'text')
    const text = textContent?.type === 'text' ? textContent.text : ''
    context += `- [${node.id}] "${title}"${isSelected ? ' (SELECTED)' : ''}: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}\n`
  }

  // List connections
  if (connections.length > 0) {
    context += '\n**Existing Connections:**\n'
    for (const conn of connections) {
      const source = nodes.find(n => n.id === conn.sourceId)
      const target = nodes.find(n => n.id === conn.targetId)
      context += `- ${source?.title || 'Untitled'} --[${conn.relationship}]--> ${target?.title || 'Untitled'}\n`
    }
  }

  // Highlight selection
  if (selectedNodes.length > 0) {
    context += '\n**Currently Selected (focus your analysis on these):**\n'
    for (const node of selectedNodes) {
      const textContent = node.content.find(c => c.type === 'text')
      const text = textContent?.type === 'text' ? textContent.text : ''
      context += `- "${node.title || 'Untitled'}": ${text}\n`
    }
  }

  return context
}

/**
 * Parse JSON from AI response (handles code blocks)
 */
function parseJsonFromResponse<T>(response: string): T[] {
  // Try to extract JSON from code block
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      console.error('Failed to parse JSON from code block')
    }
  }

  // Try to parse the whole response as JSON
  try {
    const parsed = JSON.parse(response)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    console.error('Failed to parse JSON from response')
  }

  return []
}

/**
 * Calculate position for new node near related node
 */
function calculateNewNodePosition(relatedNode: IdeaNode | undefined, existingNodes: IdeaNode[]): Position {
  if (relatedNode) {
    // Position to the right of the related node with some offset
    return {
      x: relatedNode.position.x + relatedNode.dimensions.width + 50,
      y: relatedNode.position.y + Math.random() * 100 - 50,
    }
  }

  // Default: find the rightmost node and add to the right
  if (existingNodes.length > 0) {
    const rightmost = existingNodes.reduce((max, node) =>
      node.position.x > max.position.x ? node : max
    )
    return {
      x: rightmost.position.x + rightmost.dimensions.width + 100,
      y: rightmost.position.y,
    }
  }

  // Fallback: center of canvas
  return { x: 400, y: 300 }
}

export function useIdeaMazeChat() {
  const {
    currentMoodboard,
    selection,
    addChatMessage,
    updateChatMessage,
    chatMessagesByMoodboard,
    addAISuggestion,
    setAIProcessing,
    isAIProcessing,
  } = useIdeaMazeStore()

  const { agentStatuses } = useSettingsStore()
  const claudeCodeStatus = agentStatuses['claude-code']

  const shouldStopRef = useRef(false)

  // Get current chat messages for this moodboard
  const chatMessages = currentMoodboard
    ? chatMessagesByMoodboard[currentMoodboard.id] || []
    : []

  /**
   * Check if Claude Code is ready
   */
  const checkClaudeCodeReady = useCallback(() => {
    if (!claudeCodeStatus?.installed) {
      throw new Error('Claude Code is not installed. Install it from https://docs.anthropic.com/en/docs/claude-code')
    }
    if (!claudeCodeStatus?.authenticated) {
      throw new Error('Claude Code is not authenticated. Run "claude login" in your terminal')
    }
  }, [claudeCodeStatus])

  /**
   * Send a chat message
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!currentMoodboard) {
      throw new Error('No moodboard selected')
    }

    checkClaudeCodeReady()

    const moodboardId = currentMoodboard.id

    // Add user message
    addChatMessage(moodboardId, { role: 'user', content })

    // Add placeholder assistant message
    const assistantMsgId = addChatMessage(moodboardId, {
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    // Build context from moodboard
    const context = buildMoodboardContext(
      currentMoodboard.nodes,
      currentMoodboard.connections,
      selection
    )

    setAIProcessing(true)
    shouldStopRef.current = false

    try {
      await sendToClaudeCodeStreaming(
        content + context,
        SYSTEM_PROMPT,
        (event: StreamEvent) => {
          if (shouldStopRef.current) return

          if (event.type === 'text' && event.content) {
            updateChatMessage(moodboardId, assistantMsgId, event.content, true)
          } else if (event.type === 'done') {
            updateChatMessage(moodboardId, assistantMsgId, '', false)
          }
        }
      )
    } catch (error) {
      console.error('Failed to send message:', error)
      updateChatMessage(
        moodboardId,
        assistantMsgId,
        `\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      )
    } finally {
      setAIProcessing(false)
    }
  }, [currentMoodboard, selection, checkClaudeCodeReady, addChatMessage, updateChatMessage, setAIProcessing])

  /**
   * Find connections between nodes
   */
  const findConnections = useCallback(async () => {
    if (!currentMoodboard || currentMoodboard.nodes.length < 2) {
      throw new Error('Need at least 2 nodes to find connections')
    }

    checkClaudeCodeReady()

    const context = buildMoodboardContext(
      currentMoodboard.nodes,
      currentMoodboard.connections,
      selection
    )

    setAIProcessing(true)

    try {
      let response = ''
      await sendToClaudeCodeStreaming(
        FIND_CONNECTIONS_PROMPT + context,
        SYSTEM_PROMPT,
        (event: StreamEvent) => {
          if (event.type === 'text' && event.content) {
            response += event.content
          }
        }
      )

      // Parse suggestions
      const suggestions = parseJsonFromResponse<ConnectionSuggestion>(response)

      // Add valid suggestions
      for (const suggestion of suggestions) {
        // Validate that source and target exist
        const sourceExists = currentMoodboard.nodes.some(n => n.id === suggestion.sourceId)
        const targetExists = currentMoodboard.nodes.some(n => n.id === suggestion.targetId)

        if (sourceExists && targetExists) {
          const aiSuggestion: AISuggestion = {
            type: 'connection',
            data: {
              id: crypto.randomUUID(),
              sourceId: suggestion.sourceId,
              targetId: suggestion.targetId,
              relationship: suggestion.relationship || 'related',
              confidence: suggestion.confidence || 0.5,
              reasoning: suggestion.reasoning || 'AI suggested connection',
            },
          }
          addAISuggestion(aiSuggestion)
        }
      }

      return suggestions.length
    } finally {
      setAIProcessing(false)
    }
  }, [currentMoodboard, selection, checkClaudeCodeReady, addAISuggestion, setAIProcessing])

  /**
   * Generate related ideas
   */
  const generateIdeas = useCallback(async () => {
    if (!currentMoodboard || currentMoodboard.nodes.length === 0) {
      throw new Error('Need at least 1 node to generate ideas')
    }

    checkClaudeCodeReady()

    const context = buildMoodboardContext(
      currentMoodboard.nodes,
      currentMoodboard.connections,
      selection
    )

    setAIProcessing(true)

    try {
      let response = ''
      await sendToClaudeCodeStreaming(
        GENERATE_IDEAS_PROMPT + context,
        SYSTEM_PROMPT,
        (event: StreamEvent) => {
          if (event.type === 'text' && event.content) {
            response += event.content
          }
        }
      )

      // Parse suggestions
      const suggestions = parseJsonFromResponse<Omit<NodeSuggestion, 'id' | 'position' | 'confidence'>>(response)

      // Add suggestions with positions
      for (const suggestion of suggestions) {
        const relatedNode = suggestion.relatedToNodeId
          ? currentMoodboard.nodes.find(n => n.id === suggestion.relatedToNodeId)
          : undefined

        const position = calculateNewNodePosition(relatedNode, currentMoodboard.nodes)

        const aiSuggestion: AISuggestion = {
          type: 'node',
          data: {
            id: crypto.randomUUID(),
            position,
            title: suggestion.title || 'New Idea',
            content: suggestion.content || '',
            relatedToNodeId: suggestion.relatedToNodeId,
            confidence: 0.7,
            reasoning: suggestion.reasoning || 'AI generated idea',
          },
        }
        addAISuggestion(aiSuggestion)
      }

      return suggestions.length
    } finally {
      setAIProcessing(false)
    }
  }, [currentMoodboard, selection, checkClaudeCodeReady, addAISuggestion, setAIProcessing])

  /**
   * Critique selected ideas
   */
  const critiqueIdeas = useCallback(async () => {
    if (!currentMoodboard || selection.nodeIds.length === 0) {
      throw new Error('Select at least 1 node to critique')
    }

    checkClaudeCodeReady()

    const context = buildMoodboardContext(
      currentMoodboard.nodes,
      currentMoodboard.connections,
      selection
    )

    setAIProcessing(true)

    try {
      let response = ''
      await sendToClaudeCodeStreaming(
        CRITIQUE_PROMPT + context,
        SYSTEM_PROMPT,
        (event: StreamEvent) => {
          if (event.type === 'text' && event.content) {
            response += event.content
          }
        }
      )

      // Parse suggestions
      const suggestions = parseJsonFromResponse<Omit<CritiqueSuggestion, 'id'>>(response)

      // Add valid critiques as suggestions (user reviews before accepting)
      for (const suggestion of suggestions) {
        // If nodeId not specified, use first selected node
        const nodeId = suggestion.nodeId || selection.nodeIds[0]
        const nodeExists = currentMoodboard.nodes.some(n => n.id === nodeId)

        if (nodeExists) {
          const aiSuggestion: AISuggestion = {
            type: 'critique',
            data: {
              id: crypto.randomUUID(),
              nodeId,
              critique: suggestion.critique || 'Review needed',
              suggestions: suggestion.suggestions || [],
              severity: suggestion.severity || 'info',
            },
          }
          addAISuggestion(aiSuggestion)
        }
      }

      return suggestions.length
    } finally {
      setAIProcessing(false)
    }
  }, [currentMoodboard, selection, checkClaudeCodeReady, addAISuggestion, setAIProcessing])

  /**
   * Stop current AI processing
   */
  const stopProcessing = useCallback(() => {
    shouldStopRef.current = true
    setAIProcessing(false)
  }, [setAIProcessing])

  return {
    chatMessages,
    isProcessing: isAIProcessing,
    sendMessage,
    findConnections,
    generateIdeas,
    critiqueIdeas,
    stopProcessing,
    isReady: claudeCodeStatus?.installed && claudeCodeStatus?.authenticated,
  }
}
