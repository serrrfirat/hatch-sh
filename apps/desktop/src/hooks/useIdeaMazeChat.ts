/**
 * useIdeaMazeChat - AI Assistant hook for Idea Maze
 *
 * Thin wrapper around the Claude Code bridge for Idea Maze specific AI interactions.
 * Reuses the same streaming infrastructure as useChat.ts
 */

import { useCallback, useRef, useState } from 'react'
import { useIdeaMazeStore } from '../stores/ideaMazeStore'
import { useSettingsStore } from '../stores/settingsStore'
import { sendToClaudeCodeStreaming, type StreamEvent } from '../lib/claudeCode/bridge'
import { saveImageForAIContext } from '../lib/ideaMaze/storage'
import type { AISuggestion, ConnectionSuggestion, NodeSuggestion, CritiqueSuggestion, IdeaNode, IdeaConnection, SelectionState, Position } from '../lib/ideaMaze/types'
import { createPlanNode } from '../lib/ideaMaze/types'
import { generatePRD } from '../lib/context/prdGenerator'
import { savePRDToAppData } from '../lib/context/prdStorage'
import { useToastStore } from '../stores/toastStore'

// System prompt for AI Assistant
const SYSTEM_PROMPT = `You are an AI assistant helping brainstorm and analyze ideas on a visual canvas called Idea Maze.
You can see the user's idea nodes and their connections.

**Important - You CAN view images**: When nodes contain images, they are saved to files and their paths are provided in the context. Use your Read tool to view these image files when you need to analyze them. Image paths will be shown as [Image file: /path/to/image.png].

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

const INTERVIEW_PROMPT = `You are conducting a structured interview to help refine ideas into a plan.

**CRITICAL FORMAT REQUIREMENT:**
Every response MUST start with a JSON code block in EXACTLY this format - no exceptions:

\`\`\`question
{
  "question": "Your question here?",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "multiSelect": false
}
\`\`\`

NEVER use lettered options like A), B), C) or bullet points. ONLY use the JSON format above.
The options array must contain 3-5 short, specific choices (each under 50 characters).

After the JSON block, you may add ONE brief sentence (optional).

**multiSelect flag:**
- true: User can pick multiple (features, platforms, integrations)
- false: Single choice (project type, primary focus, either/or decisions)

**Interview goal:** Extract summary, 3-7 requirements, design notes, technical approach.

**When done interviewing**, output the plan instead:
\`\`\`plan
{
  "summary": "What to build",
  "requirements": ["Req 1", "Req 2", "Req 3"],
  "designNotes": "UI preferences or null",
  "technicalApproach": "Tech decisions or null"
}
\`\`\`

Start now with a brief greeting and your first question in JSON format.`

// Continuation prompt for follow-up questions in interview
const INTERVIEW_CONTINUATION_PROMPT = `**CRITICAL FORMAT REQUIREMENT:**
Your response MUST start with a JSON code block in EXACTLY this format:

\`\`\`question
{
  "question": "Your follow-up question?",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "multiSelect": false
}
\`\`\`

NEVER use A), B), C) or bullet points for options. ONLY use the JSON format above.
Options must be 3-5 short choices (under 50 characters each).

After the JSON, you may add ONE brief sentence like "Got it!" (optional).

**multiSelect flag:**
- true: User can pick multiple (features, platforms, integrations)
- false: Single choice (primary focus, either/or decisions)

**When you have enough info** (summary + 3+ requirements), output the plan instead:
\`\`\`plan
{
  "summary": "What to build",
  "requirements": ["Req 1", "Req 2", "Req 3"],
  "designNotes": "UI preferences or null",
  "technicalApproach": "Tech decisions or null"
}
\`\`\`

Respond now with your next question in JSON format.`

/**
 * Build context string from moodboard state
 * Includes both text and image content from nodes
 * Images are saved to files so Claude Code can read them
 */
async function buildMoodboardContext(
  nodes: IdeaNode[],
  connections: IdeaConnection[],
  selection: SelectionState
): Promise<string> {
  const selectedNodes = nodes.filter(n => selection.nodeIds.includes(n.id))
  const selectedNodeIds = new Set(selection.nodeIds)

  let context = '\n\nCurrent moodboard context:\n'

  // List all nodes with their content
  context += '\n**All Nodes:**\n'
  for (const node of nodes) {
    const isSelected = selectedNodeIds.has(node.id)
    const title = node.title || 'Untitled'
    const textContent = node.content.find(c => c.type === 'text')
    const text = textContent?.type === 'text' ? textContent.text : ''
    const imageCount = node.content.filter(c => c.type === 'image').length

    let nodeInfo = `- [${node.id}] "${title}"${isSelected ? ' (SELECTED)' : ''}`
    if (text) {
      nodeInfo += `: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`
    }
    if (imageCount > 0) {
      nodeInfo += ` [${imageCount} image${imageCount > 1 ? 's' : ''} attached]`
    }
    context += nodeInfo + '\n'
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

  // Highlight selection with full content including images
  if (selectedNodes.length > 0) {
    context += '\n**Currently Selected (focus your analysis on these):**\n'
    for (const node of selectedNodes) {
      context += `\n### "${node.title || 'Untitled'}"\n`

      // Include all content from selected nodes
      for (const content of node.content) {
        if (content.type === 'text') {
          context += `${content.text}\n`
        } else if (content.type === 'image') {
          const alt = content.alt || 'Pasted image'
          // Save image to file so Claude Code can read it
          const filePath = await saveImageForAIContext(content.url, content.id)
          if (filePath) {
            context += `\n[Image file: ${filePath}]\n`
            context += `Description: ${alt}\n`
            context += `(Use your Read tool to view this image file)\n`
          } else {
            context += `\n[Image: ${alt}] (could not save to file)\n`
          }
        } else if (content.type === 'url') {
          context += `\nLink: ${content.title || content.url}\n`
          if (content.description) {
            context += `Description: ${content.description}\n`
          }
          context += `URL: ${content.url}\n`
        }
      }
    }
  }

  return context
}

/**
 * Build focused context for interview continuation (only includes the ideas being interviewed about)
 */
function buildInterviewContext(
  nodes: IdeaNode[],
  interviewSourceIds: string[]
): string {
  const sourceNodes = nodes.filter(n => interviewSourceIds.includes(n.id))

  // Don't include any context - the AI already has it from the conversation history
  // Just remind it what ideas we're discussing
  if (sourceNodes.length === 0) return ''

  let context = '\n\n(Reminder: We are discussing these specific ideas: '
  context += sourceNodes.map(n => `"${n.title || 'Untitled'}"`).join(', ')
  context += ')'

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
      // intentionally empty
    }
  }
  // Try to parse the whole response as JSON
  try {
    const parsed = JSON.parse(response)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    // intentionally empty
  }
  return []
}

/**
 * Parse plan from AI response (uses ```plan code block)
 */
function parsePlanFromResponse(response: string): {
  summary: string
  requirements: string[]
  designNotes?: string
  technicalApproach?: string
} | null {
  // Look for ```plan code block
  const planBlockMatch = response.match(/```plan\s*([\s\S]*?)```/)
  if (planBlockMatch) {
    try {
      const plan = JSON.parse(planBlockMatch[1].trim())
      if (plan.summary && Array.isArray(plan.requirements)) {
        return {
          summary: plan.summary,
          requirements: plan.requirements,
          designNotes: plan.designNotes || undefined,
          technicalApproach: plan.technicalApproach || undefined,
        }
      }
    } catch {
      // intentionally empty
    }
  }
  return null
}

/**
 * Parse multiple choice question from AI response (uses ```question code block)
 */
function parseQuestionFromResponse(response: string): {
  question: string
  options: string[]
  multiSelect: boolean
} | null {
  // Look for ```question code block
  const questionBlockMatch = response.match(/```question\s*([\s\S]*?)```/)
  if (questionBlockMatch) {
    try {
      const parsed = JSON.parse(questionBlockMatch[1].trim())
      if (parsed.question && Array.isArray(parsed.options) && parsed.options.length > 0) {
        return {
          question: parsed.question,
          options: parsed.options,
          multiSelect: parsed.multiSelect === true, // Default to false if not specified
        }
      }
    } catch {
      // intentionally empty
    }
  }
  return null
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
    addNode,
    addConnection,
  } = useIdeaMazeStore()

  // Track interview state (which node IDs we're interviewing about)
  const interviewSourceIdsRef = useRef<string[]>([])

  // Track current interview question and options for multiple choice UI
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null)
  const [currentOptions, setCurrentOptions] = useState<string[] | null>(null)
  const [isMultiSelect, setIsMultiSelect] = useState(false)

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

    // Use interview continuation prompt and focused context if in interview mode
    const isInInterviewMode = interviewSourceIdsRef.current.length > 0
    const systemPrompt = isInInterviewMode ? INTERVIEW_CONTINUATION_PROMPT : SYSTEM_PROMPT

    // Build context - use focused context for interview, full context otherwise
    const context = isInInterviewMode
      ? buildInterviewContext(currentMoodboard.nodes, interviewSourceIdsRef.current)
      : await buildMoodboardContext(currentMoodboard.nodes, currentMoodboard.connections, selection)

    setAIProcessing(true)
    shouldStopRef.current = false

    let fullResponse = ''

    try {
      await sendToClaudeCodeStreaming(
        content + context,
        systemPrompt,
        (event: StreamEvent) => {
          if (shouldStopRef.current) return

          if (event.type === 'text' && event.content) {
            fullResponse += event.content
            updateChatMessage(moodboardId, assistantMsgId, event.content, true)
          } else if (event.type === 'done') {
            updateChatMessage(moodboardId, assistantMsgId, '', false)

            // Check if this response contains a plan (interview complete)
            const plan = parsePlanFromResponse(fullResponse)
            if (plan && interviewSourceIdsRef.current.length > 0) {
              // Calculate position for Plan node (center of source ideas)
              const sourceNodes = currentMoodboard.nodes.filter(n =>
                interviewSourceIdsRef.current.includes(n.id)
              )
              const avgX = sourceNodes.reduce((sum, n) => sum + n.position.x, 0) / sourceNodes.length
              const avgY = sourceNodes.reduce((sum, n) => sum + n.position.y, 0) / sourceNodes.length
              const position = { x: avgX + 350, y: avgY }

              // Create Plan node
              const planNode = createPlanNode(position, {
                ...plan,
                sourceIdeaIds: interviewSourceIdsRef.current,
              }, 'Plan')

              // Add the plan node to the moodboard
              const newNode = addNode(position, planNode.content, planNode.title)

              // Connect source ideas to the plan node
              for (const sourceId of interviewSourceIdsRef.current) {
                addConnection(sourceId, newNode.id, 'extends')
              }

              // Generate and save PRD (non-blocking)
              try {
                const moodboard = useIdeaMazeStore.getState().currentMoodboard
                if (moodboard) {
                  const prd = generatePRD(moodboard, newNode)
                  useIdeaMazeStore.getState().setCurrentPRD(prd)
                  savePRDToAppData(moodboard.id, prd).catch(() => {})
                  useToastStore.getState().showToast({
                    message: `PRD generated: ${prd.plan.requirements.length} requirements, ${prd.dependencyGraph.length} dependencies`,
                    type: 'success',
                    dismissTimeout: 5000,
                    undoCallback: () => {
                      useIdeaMazeStore.getState().setCurrentPRD(null)
                    },
                  })
                }
              } catch {
                // PRD generation failure should not break plan creation
              }

              // Clear interview state (including options)
              interviewSourceIdsRef.current = []
              setCurrentQuestion(null)
              setCurrentOptions(null)
              setIsMultiSelect(false)
            } else if (interviewSourceIdsRef.current.length > 0) {
              // We're in interview mode - check for multiple choice question
              const questionData = parseQuestionFromResponse(fullResponse)
              if (questionData) {
                setCurrentQuestion(questionData.question)
                setCurrentOptions(questionData.options)
                setIsMultiSelect(questionData.multiSelect)
              } else {
                // No question found, clear options
                setCurrentQuestion(null)
                setCurrentOptions(null)
                setIsMultiSelect(false)
              }
            }
          }
        }
      )
    } catch (error) {
      updateChatMessage(
        moodboardId,
        assistantMsgId,
        `\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      )
    } finally {
      setAIProcessing(false)
    }
  }, [currentMoodboard, selection, checkClaudeCodeReady, addChatMessage, updateChatMessage, setAIProcessing, addNode, addConnection])

  /**
   * Find connections between nodes
   */
  const findConnections = useCallback(async () => {
    if (!currentMoodboard || currentMoodboard.nodes.length < 2) {
      throw new Error('Need at least 2 nodes to find connections')
    }

    checkClaudeCodeReady()

    const context = await buildMoodboardContext(
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

    const context = await buildMoodboardContext(
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

    const context = await buildMoodboardContext(
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
   * Start an interview to create a Plan from selected ideas
   */
  const startInterview = useCallback(async () => {
    if (!currentMoodboard || selection.nodeIds.length === 0) {
      throw new Error('Select at least 1 node to create a plan')
    }

    checkClaudeCodeReady()

    const moodboardId = currentMoodboard.id

    // Store the source idea IDs for when the plan is generated
    interviewSourceIdsRef.current = [...selection.nodeIds]

    // Build context with selected ideas
    const selectedNodes = currentMoodboard.nodes.filter(n =>
      selection.nodeIds.includes(n.id)
    )

    let context = '\n\n**Ideas to discuss:**\n'
    for (const node of selectedNodes) {
      const textContent = node.content.find(c => c.type === 'text')
      const text = textContent?.type === 'text' ? textContent.text : ''
      context += `\n### ${node.title || 'Untitled'}\n${text}\n`
    }

    // Add relevant connections
    const relevantConnections = currentMoodboard.connections.filter(c =>
      selection.nodeIds.includes(c.sourceId) || selection.nodeIds.includes(c.targetId)
    )
    if (relevantConnections.length > 0) {
      context += '\n**Existing connections:**\n'
      for (const conn of relevantConnections) {
        const source = currentMoodboard.nodes.find(n => n.id === conn.sourceId)
        const target = currentMoodboard.nodes.find(n => n.id === conn.targetId)
        context += `- ${source?.title || 'Untitled'} --[${conn.relationship}]--> ${target?.title || 'Untitled'}\n`
      }
    }

    // Add system message to start the interview
    addChatMessage(moodboardId, {
      role: 'user',
      content: '[Starting interview to create a plan from selected ideas]',
    })

    // Add placeholder assistant message
    const assistantMsgId = addChatMessage(moodboardId, {
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    setAIProcessing(true)
    shouldStopRef.current = false

    // Clear any previous question options
    setCurrentQuestion(null)
    setCurrentOptions(null)
    setIsMultiSelect(false)

    let fullResponse = ''

    try {
      await sendToClaudeCodeStreaming(
        INTERVIEW_PROMPT + context,
        SYSTEM_PROMPT,
        (event: StreamEvent) => {
          if (shouldStopRef.current) return

          if (event.type === 'text' && event.content) {
            fullResponse += event.content
            updateChatMessage(moodboardId, assistantMsgId, event.content, true)
          } else if (event.type === 'done') {
            updateChatMessage(moodboardId, assistantMsgId, '', false)

            // Parse question for multiple choice UI
            const questionData = parseQuestionFromResponse(fullResponse)
            if (questionData) {
              setCurrentQuestion(questionData.question)
              setCurrentOptions(questionData.options)
              setIsMultiSelect(questionData.multiSelect)
            }
          }
        }
      )
    } catch (error) {
      updateChatMessage(
        moodboardId,
        assistantMsgId,
        `\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      )
      // Clear interview state on error
      interviewSourceIdsRef.current = []
      setCurrentQuestion(null)
      setCurrentOptions(null)
      setIsMultiSelect(false)
    } finally {
      setAIProcessing(false)
    }
  }, [currentMoodboard, selection, checkClaudeCodeReady, addChatMessage, updateChatMessage, setAIProcessing])

  /**
   * Start an interview to create a Plan from ALL ideas on the moodboard
   */
  const startMoodboardInterview = useCallback(async () => {
    if (!currentMoodboard || currentMoodboard.nodes.length === 0) {
      throw new Error('Need at least 1 idea on the moodboard')
    }

    // Filter out Plan nodes - we only want to interview about idea nodes
    const ideaNodes = currentMoodboard.nodes.filter(n => !n.content.some(c => c.type === 'plan'))
    if (ideaNodes.length === 0) {
      throw new Error('No ideas to interview about (only Plan nodes found)')
    }

    checkClaudeCodeReady()

    const moodboardId = currentMoodboard.id

    // Store ALL idea node IDs as the source
    interviewSourceIdsRef.current = ideaNodes.map(n => n.id)

    // Build context with all ideas
    let context = '\n\n**All ideas on the moodboard:**\n'
    for (const node of ideaNodes) {
      const textContent = node.content.find(c => c.type === 'text')
      const text = textContent?.type === 'text' ? textContent.text : ''
      context += `\n### ${node.title || 'Untitled'}\n${text}\n`
    }

    // Add all connections
    if (currentMoodboard.connections.length > 0) {
      context += '\n**Connections between ideas:**\n'
      for (const conn of currentMoodboard.connections) {
        const source = currentMoodboard.nodes.find(n => n.id === conn.sourceId)
        const target = currentMoodboard.nodes.find(n => n.id === conn.targetId)
        if (source && target) {
          context += `- ${source.title || 'Untitled'} --[${conn.relationship}]--> ${target.title || 'Untitled'}\n`
        }
      }
    }

    // Add system message to start the interview
    addChatMessage(moodboardId, {
      role: 'user',
      content: '[Starting interview to create a plan from all moodboard ideas]',
    })

    // Add placeholder assistant message
    const assistantMsgId = addChatMessage(moodboardId, {
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    setAIProcessing(true)
    shouldStopRef.current = false

    // Clear any previous question options
    setCurrentQuestion(null)
    setCurrentOptions(null)
    setIsMultiSelect(false)

    let fullResponse = ''

    try {
      await sendToClaudeCodeStreaming(
        INTERVIEW_PROMPT + context,
        SYSTEM_PROMPT,
        (event: StreamEvent) => {
          if (shouldStopRef.current) return

          if (event.type === 'text' && event.content) {
            fullResponse += event.content
            updateChatMessage(moodboardId, assistantMsgId, event.content, true)
          } else if (event.type === 'done') {
            updateChatMessage(moodboardId, assistantMsgId, '', false)

            // Parse question for multiple choice UI
            const questionData = parseQuestionFromResponse(fullResponse)
            if (questionData) {
              setCurrentQuestion(questionData.question)
              setCurrentOptions(questionData.options)
              setIsMultiSelect(questionData.multiSelect)
            }
          }
        }
      )
    } catch (error) {
      updateChatMessage(
        moodboardId,
        assistantMsgId,
        `\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      )
      // Clear interview state on error
      interviewSourceIdsRef.current = []
      setCurrentQuestion(null)
      setCurrentOptions(null)
      setIsMultiSelect(false)
    } finally {
      setAIProcessing(false)
    }
  }, [currentMoodboard, checkClaudeCodeReady, addChatMessage, updateChatMessage, setAIProcessing])

  /**
   * Stop current AI processing
   */
  const stopProcessing = useCallback(() => {
    shouldStopRef.current = true
    setAIProcessing(false)
  }, [setAIProcessing])

  /**
   * Cancel the current interview and clear interview state
   */
  const cancelInterview = useCallback(() => {
    interviewSourceIdsRef.current = []
    setCurrentQuestion(null)
    setCurrentOptions(null)
    setIsMultiSelect(false)
    shouldStopRef.current = true
    setAIProcessing(false)
  }, [setAIProcessing])

  /**
   * Select an option from multiple choice interview question (single select)
   */
  const selectOption = useCallback(async (option: string) => {
    // Clear current options before sending
    setCurrentQuestion(null)
    setCurrentOptions(null)
    setIsMultiSelect(false)
    // Send the selected option as a message
    await sendMessage(option)
  }, [sendMessage])

  /**
   * Submit multiple selected options (multi-select mode)
   */
  const submitMultipleOptions = useCallback(async (options: string[]) => {
    // Clear current options before sending
    setCurrentQuestion(null)
    setCurrentOptions(null)
    setIsMultiSelect(false)
    // Join options with commas and "and" for the last one
    let message: string
    if (options.length === 1) {
      message = options[0]
    } else if (options.length === 2) {
      message = `${options[0]} and ${options[1]}`
    } else {
      const lastOption = options[options.length - 1]
      const otherOptions = options.slice(0, -1).join(', ')
      message = `${otherOptions}, and ${lastOption}`
    }
    // Send the combined selection as a message
    await sendMessage(message)
  }, [sendMessage])

  return {
    chatMessages,
    isProcessing: isAIProcessing,
    sendMessage,
    findConnections,
    generateIdeas,
    critiqueIdeas,
    startInterview,
    startMoodboardInterview,
    stopProcessing,
    cancelInterview,
    selectOption,
    submitMultipleOptions,
    currentQuestion,
    currentOptions,
    isMultiSelect,
    isReady: claudeCodeStatus?.installed && claudeCodeStatus?.authenticated,
    isInterviewing: interviewSourceIdsRef.current.length > 0,
  }
}
