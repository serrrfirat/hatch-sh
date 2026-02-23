import { useCallback, useRef } from 'react'
import {
  useChatStore,
  selectCurrentMessages,
  type Message,
  type ToolUse,
} from '../stores/chatStore'
import { useSettingsStore, isWorkspaceAgentReady, getAgentStatus } from '../stores/settingsStore'
import { useRepositoryStore } from '../stores/repositoryStore'
import type { AgentId, StreamEvent, AgentMessage, LocalAgentId } from '../lib/agents/types'
import { isLocalAgent } from '../lib/agents/types'
import { getLocalAdapter, getConfig } from '../lib/agents/registry'
import {
  appendStreamInterruptedNotice,
  createLineBuffer,
  retryWithExponentialBackoff,
  safeParseJsonLine,
} from '../lib/agents/streamUtils'
import { extractCodeBlocks } from '../lib/codeExtractor'
import { writeCodeBlocksToWorkspace } from '../lib/fileWriter'
// readProjectMemory is available for future system prompt enrichment
import { windowMessages, getDroppedMessages } from '../lib/chatWindow'
import { summarizeDroppedMessages } from '../lib/chatSummarizer'
import { saveImageToWorkspace, type ImageAttachmentData } from '../lib/imageAttachment'
import { parseSlashCommand } from '../lib/slashCommands'
import { buildReviewPrompt } from '../lib/codeReview'
import { getDiff } from '../lib/git/bridge'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

class StreamInterruptedError extends Error {
  partialContent: string

  constructor(message: string, partialContent: string) {
    super(message)
    this.name = 'StreamInterruptedError'
    this.partialContent = partialContent
  }
}

const isRetryableCloudError = (error: unknown): boolean => {
  if (error instanceof Error && error.name === 'AbortError') {
    return false
  }

  if (error instanceof StreamInterruptedError) {
    return true
  }

  return error instanceof TypeError
}

const SYSTEM_PROMPT = `You are a helpful coding assistant working in the user's project.

Guidelines:
- Be conversational and natural. Respond like a helpful colleague, not a robot.
- Do NOT repeat or summarize project context (README, tech stack, etc.) unless the user specifically asks about it.
- Focus on answering the user's actual question or request directly.
- If the user just says "hello" or greets you, respond with a simple greeting and ask how you can help.
- When generating code, use modern patterns appropriate for the project's tech stack.
- Be concise. Don't over-explain unless asked.

Remember: The user already knows what project they're working on. Don't tell them.`

/**
 * PR Creation prompt - injected when user triggers "Open PR"
 * Instructs the agent on the exact steps to create a pull request
 */
const OPEN_PR_PROMPT = `The user likes the state of the code and wants to create a Pull Request.

Follow these exact steps to create a PR:

1. Run git diff to review uncommitted changes
2. Commit them. Follow any instructions the user gave you about writing commit messages.
3. Push to origin.
4. Use the mcp__conductor__GetWorkspaceDiff tool to review the PR diff
5. Use gh pr create --base {targetBranch} to create a PR onto the target branch. Keep the title under 80 characters and the description under five sentences (unless the user has given you other instructions).
6. If any of these steps fail, ask the user for help.`

/**
 * Build context for PR creation
 */
function buildPRContext(
  workspace: {
    branchName: string
    localPath: string
    uncommittedChanges?: number
  },
  targetBranch: string
): string {
  let context = '\n\n**Workspace Context:**\n'
  context += `- Current branch: ${workspace.branchName}\n`
  context += `- Target branch: origin/${targetBranch}\n`
  context += `- Working directory: ${workspace.localPath}\n`

  if (workspace.uncommittedChanges !== undefined) {
    context += `- Uncommitted changes: ${workspace.uncommittedChanges} files\n`
  }

  context += `\nThere is no upstream branch yet. The user requested a PR.\n`

  return context
}

export function useChat() {
  // Use selector for reactive messages (per-workspace)
  const messages = useChatStore(selectCurrentMessages)

  const {
    isLoading,
    currentProjectId,
    addMessage,
    updateMessage,
    updateMessageThinking,
    addToolUse,
    updateToolUse,
    setMessageDuration,
    setLoading,
    updateMessageMetadata,
  } = useChatStore()

  const settingsState = useSettingsStore()
  const { agentStatuses, agentModels } = settingsState

  // Get current workspace and its selected agent
  const { currentWorkspace } = useRepositoryStore()
  const workspaceAgentId = currentWorkspace?.agentId || 'claude-code'

  const abortControllerRef = useRef<AbortController | null>(null)
  const streamingMessageIdRef = useRef<string | null>(null)
  const shouldStopRef = useRef(false)
  // projectMemoryLoadedRef: reserved for future per-workspace memory dedup
  const summaryCacheRef = useRef<{ droppedIds: string; summary: string }>({ droppedIds: '', summary: '' })

  /**
   * Convert chat messages to agent message format
   */
  const formatMessagesForAgent = (msgs: Message[]): AgentMessage[] => {
    return msgs
      .filter((m) => !m.isStreaming && m.content.trim())
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
  }

  /**
   * Send message via a local CLI agent (Claude Code, Opencode, Cursor)
   */
  const sendLocalAgentMessage = useCallback(
    async (agentId: LocalAgentId, content: string, assistantMessageId: string) => {
      const status = agentStatuses[agentId]
      const config = getConfig(agentId)

      // Check agent is ready
      if (!status?.installed) {
        throw new Error(`${config.name} is not installed. Install it from ${config.installUrl}`)
      }
      if (!status?.authenticated) {
        throw new Error(
          `${config.name} is not authenticated. Run "${config.authCommand}" in your terminal`
        )
      }

      shouldStopRef.current = false

      const currentMessages = selectCurrentMessages(useChatStore.getState())
      const filteredMessages = currentMessages.filter((m: Message) => m.id !== assistantMessageId)
      const { contextWindowSize } = useChatStore.getState()
      const messagesToSend = windowMessages(filteredMessages, contextWindowSize)

      const droppedMessages = getDroppedMessages(filteredMessages, contextWindowSize)
      let summaryMessage: AgentMessage | null = null
      if (droppedMessages.length > 0) {
        const droppedIds = droppedMessages.map((m) => m.id).join(',')
        if (droppedIds !== summaryCacheRef.current.droppedIds) {
          summaryCacheRef.current = { droppedIds, summary: summarizeDroppedMessages(droppedMessages) }
        }
        if (summaryCacheRef.current.summary) {
          summaryMessage = { role: 'user', content: summaryCacheRef.current.summary }
        }
      }
      const formattedMessages = formatMessagesForAgent(messagesToSend)
      if (summaryMessage) {
        formattedMessages.unshift(summaryMessage)
      }
      formattedMessages.push({ role: 'user', content })

      let fullContent = ''
      let thinkingContent = ''
      const toolUseMap = new Map<string, string>() // toolId -> messageToolId

      // Stream handler (agent-agnostic)
      const onStream = (event: StreamEvent) => {
        if (shouldStopRef.current) return

        if (event.type === 'text' && event.content) {
          fullContent += event.content
          updateMessage(assistantMessageId, fullContent, true)
        } else if (event.type === 'thinking' && event.content) {
          thinkingContent += event.content
          updateMessageThinking(assistantMessageId, thinkingContent)
        } else if (event.type === 'tool_use' && event.toolName && event.toolId) {
          // Add tool use to the message
          const tool: ToolUse = {
            id: event.toolId,
            name: event.toolName,
            input: event.toolInput || {},
            status: 'running',
          }
          addToolUse(assistantMessageId, tool)
          toolUseMap.set(event.toolId, event.toolId)
        } else if (event.type === 'tool_result' && event.toolId) {
          // Update tool use with result
          updateToolUse(assistantMessageId, event.toolId, {
            result: event.toolResult,
            status: 'completed',
          })
        } else if (event.type === 'error') {
        }
      }

      try {
        // Get the adapter and send message
        const adapter = getLocalAdapter(agentId)

        // Get model configuration for opencode and cursor agents
        const model =
          agentId === 'opencode'
            ? agentModels.opencode
            : agentId === 'cursor'
              ? agentModels.cursor
              : undefined

        // Get workspace path for agent working directory
        const workspaceState = useRepositoryStore.getState()
        const workingDirectory = workspaceState.currentWorkspace?.localPath

        fullContent = await adapter.sendMessage(formattedMessages, {
          systemPrompt: SYSTEM_PROMPT,
          onStream,
          model,
          workingDirectory,
        })
      } catch (error) {
        if (shouldStopRef.current) {
          // User stopped generation
          return fullContent || 'Generation stopped.'
        }
        throw error
      }

      return fullContent
    },
    [agentStatuses, agentModels, updateMessage, updateMessageThinking, addToolUse, updateToolUse]
  )

  /**
   * Send message via cloud API (for cloud models like Opus, Sonnet, Haiku, GPT)
   * Uses the hatch.sh API with model selection
   */
  const sendCloudModelMessage = useCallback(
    async (modelId: AgentId, content: string, assistantMessageId: string) => {
      let fullContent = ''

      await retryWithExponentialBackoff(
        async () => {
          abortControllerRef.current = new AbortController()

          const response = await fetch(`${API_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: currentProjectId,
              message: content,
              model: modelId,
            }),
            signal: abortControllerRef.current.signal,
          })

          if (!response.ok) {
            throw new Error(`Chat request failed (${response.status})`)
          }
          if (!response.body) {
            throw new Error('No response body')
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          const lineBuffer = createLineBuffer()
          let streamComplete = false

          while (!streamComplete) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            for (const line of lineBuffer.pushChunk(chunk)) {
              const trimmedLine = line.trim()
              if (!trimmedLine.startsWith('data:')) {
                continue
              }

              const rawData = trimmedLine.slice(5).trim()
              if (!rawData) {
                continue
              }

              const parsed = safeParseJsonLine(rawData, 'cloud-api')
              if (parsed.errorEvent) {
                continue
              }

              if (!parsed.value || typeof parsed.value !== 'object') {
                continue
              }

              const data = parsed.value as Record<string, unknown>

              if (typeof data.text === 'string' && data.text.length > 0) {
                fullContent += data.text
                updateMessage(assistantMessageId, fullContent, true)
              }

              if (data.done === true) {
                streamComplete = true
                break
              }
            }
          }

          for (const line of lineBuffer.flush()) {
            const trimmedLine = line.trim()
            if (!trimmedLine.startsWith('data:')) {
              continue
            }
            const rawData = trimmedLine.slice(5).trim()
            const parsed = safeParseJsonLine(rawData, 'cloud-api')
            if (parsed.errorEvent || !parsed.value || typeof parsed.value !== 'object') {
              continue
            }

            const data = parsed.value as Record<string, unknown>
            if (typeof data.text === 'string' && data.text.length > 0) {
              fullContent += data.text
              updateMessage(assistantMessageId, fullContent, true)
            }
            if (data.done === true) {
              streamComplete = true
            }
          }

          if (!streamComplete) {
            throw new StreamInterruptedError('Cloud stream interrupted', fullContent)
          }
        },
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          shouldRetry: isRetryableCloudError,
          onRetry: (_attempt: number, _delayMs: number, _error: unknown) => {
          },
        }
      )

      return fullContent
    },
    [currentProjectId, updateMessage]
  )

  // buildSystemPrompt: reserved for future system prompt enrichment with project memory
  // Uses readProjectMemory(workspacePath) to load .hatch/context.md

  const sendMessage = useCallback(
    async (content: string, images?: ImageAttachmentData[]) => {
      if (!content.trim() && (!images || images.length === 0)) return


      // Intercept /review slash command
      let agentContent = content
      const slashResult = parseSlashCommand(content, { isStreaming: isLoading })
      if (slashResult?.type === 'review') {
        if (!currentWorkspace?.localPath) {
          addMessage({
            role: 'assistant',
            content: 'No workspace selected. Please select a workspace to review changes.',
          })
          return
        }
        let diff: string
        try {
          diff = await getDiff(currentWorkspace.localPath)
        } catch {
          addMessage({ role: 'user', content })
          addMessage({
            role: 'assistant',
            content: 'Failed to get git diff. Make sure the workspace is a git repository.',
          })
          return
        }
        const reviewPrompt = buildReviewPrompt(diff, slashResult.scope)
        if (!diff.trim()) {
          addMessage({ role: 'user', content })
          addMessage({ role: 'assistant', content: reviewPrompt })
          return
        }
        agentContent = reviewPrompt
      }

      // Get the workspace's selected agent
      const agentId = workspaceAgentId
      const config = getConfig(agentId)
      const isLocal = isLocalAgent(agentId)

      // For cloud models, require project selection
      // For local agents, allow chat without project (standalone mode)
      if (!isLocal && !currentProjectId) {
        addMessage({
          role: 'assistant',
          content: 'Please select a project before sending messages with cloud models.',
        })
        return
      }

      // Check local agent requirements
      if (isLocal && !isWorkspaceAgentReady(settingsState, agentId)) {
        const status = getAgentStatus(settingsState, agentId)

        if (!status?.installed) {
          addMessage({
            role: 'assistant',
            content: `${config.name} is not installed. Please install it from ${config.installUrl} and then click 'Check Connection' in settings.`,
          })
        } else if (!status?.authenticated) {
          addMessage({
            role: 'assistant',
            content: `${config.name} is not authenticated. Please run "${config.authCommand}" in your terminal, then click "Check Connection" in settings.`,
          })
        } else {
          addMessage({
            role: 'assistant',
            content: `Please connect to ${config.name} in settings to continue.`,
          })
        }
        return
      }

      // Add user message
      addMessage({ role: 'user', content, images })


      // Save images to workspace .context/ directory via Tauri FS
      if (images && images.length > 0 && currentWorkspace?.localPath) {
        Promise.all(
          images.map((img) => saveImageToWorkspace(img, currentWorkspace.localPath))
        ).catch(() => {
          // Silently ignore save failures — images are still in base64 in the message
        })
      }

      // Warn about cloud models and local images
      if (!isLocal && images && images.length > 0) {
        addMessage({
          role: 'assistant',
          content: '⚠️ Cloud models cannot access local images directly. Images are being sent as base64 data.',
        })
      }

      // Create placeholder for assistant response
      const assistantMessageId = addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
      })
      streamingMessageIdRef.current = assistantMessageId

      setLoading(true)

      // IMPORTANT: Allow React to flush state updates and render the UI
      // before starting the potentially blocking async operation.
      // This ensures user sees their message + "Thinking..." indicator immediately.
      await new Promise((resolve) => setTimeout(resolve, 0))

      try {
        let fullContent: string

        if (isLocal) {
          // Send via local CLI agent adapter
          fullContent = await sendLocalAgentMessage(
            agentId as LocalAgentId,
            agentContent,
            assistantMessageId
          )
        } else {
          // Send via cloud API with model selection
          fullContent = await sendCloudModelMessage(agentId, agentContent, assistantMessageId)
        }

        // Mark streaming as complete and set duration
        updateMessage(assistantMessageId, fullContent, false)

        const codeBlocks = extractCodeBlocks(fullContent)
        if (codeBlocks.length > 0 && currentWorkspace?.localPath) {
          try {
            const manifest = await writeCodeBlocksToWorkspace(
              codeBlocks.map((block) => ({
                filePath: block.filePath,
                content: block.content,
              })),
              currentWorkspace.localPath
            )

            if (manifest.length > 0) {
              updateMessageMetadata(assistantMessageId, { writtenFiles: manifest })
            }
          } catch (error) {
          }
        }

        setMessageDuration(assistantMessageId)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Keep the partial content but mark as not streaming
          const currentMessages = selectCurrentMessages(useChatStore.getState())
          const streamingMsg = currentMessages.find((m: Message) => m.id === assistantMessageId)
          if (streamingMsg) {
            updateMessage(assistantMessageId, streamingMsg.content || 'Generation stopped.', false)
          }
          return
        }

        const currentMessages = selectCurrentMessages(useChatStore.getState())
        const streamingMsg = currentMessages.find((m: Message) => m.id === assistantMessageId)
        const partialContent = streamingMsg?.content?.trim() || ''

        if (
          partialContent &&
          (error instanceof StreamInterruptedError ||
            (error instanceof Error && /interrupted|stream closed|exit code/i.test(error.message)))
        ) {
          updateMessage(
            assistantMessageId,
            appendStreamInterruptedNotice(streamingMsg?.content || partialContent),
            false
          )
          setMessageDuration(assistantMessageId)
          return
        }

        updateMessage(
          assistantMessageId,
          `Sorry, an error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
          false
        )
      } finally {
        setLoading(false)
        streamingMessageIdRef.current = null
      }
    },
    [
      currentProjectId,
      workspaceAgentId,
      isLoading,
      settingsState,
      addMessage,
      updateMessage,
      setMessageDuration,
      setLoading,
      sendLocalAgentMessage,
      sendCloudModelMessage,
      currentWorkspace?.localPath,
      updateMessageMetadata,
    ]
  )

  const stopGeneration = useCallback(() => {
    // For cloud mode, abort the fetch
    abortControllerRef.current?.abort()

    // For local agent modes, set the stop flag
    shouldStopRef.current = true

    // Update the streaming message to mark it as complete
    if (streamingMessageIdRef.current) {
      const currentMessages = selectCurrentMessages(useChatStore.getState())
      const streamingMsg = currentMessages.find((m: Message) => m.id === streamingMessageIdRef.current)
      if (streamingMsg) {
        updateMessage(
          streamingMessageIdRef.current,
          streamingMsg.content || 'Generation stopped.',
          false
        )
      }
      streamingMessageIdRef.current = null
    }

    setLoading(false)
  }, [setLoading, updateMessage])

  /**
   * Send the "Open PR" message with PR creation instructions
   * This is triggered when user clicks "Create PR" in the UI
   */
  const sendOpenPRMessage = useCallback(
    async (uncommittedChanges?: number) => {
      if (!currentWorkspace) {
        addMessage({
          role: 'assistant',
          content: 'No workspace selected. Please select a workspace first.',
        })
        return
      }

      const repo = useRepositoryStore
        .getState()
        .repositories.find((r) => r.id === currentWorkspace.repositoryId)
      const targetBranch = repo?.default_branch || 'master'

      // Build the PR context
      const context = buildPRContext(
        {
          branchName: currentWorkspace.branchName,
          localPath: currentWorkspace.localPath,
          uncommittedChanges,
        },
        targetBranch
      )

      // Replace placeholder in prompt with actual target branch
      const promptWithBranch = OPEN_PR_PROMPT.replace('{targetBranch}', targetBranch)

      // Send the PR creation prompt with context
      await sendMessage(promptWithBranch + context)
    },
    [currentWorkspace, addMessage, sendMessage]
  )

  return {
    messages,
    isLoading,
    workspaceAgentId,
    sendMessage,
    sendOpenPRMessage,
    stopGeneration,
  }
}
