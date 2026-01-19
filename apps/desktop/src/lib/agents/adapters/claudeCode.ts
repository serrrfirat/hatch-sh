/**
 * Claude Code Adapter
 *
 * Integrates Anthropic's Claude Code CLI into the multi-agent system.
 * Uses JSONL output format for streaming responses.
 * Streams events in real-time via Tauri events.
 */

import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type {
  AgentAdapter,
  AgentConfig,
  AgentMessage,
  AgentStatus,
  CommandResult,
  StreamEvent,
  SendMessageOptions,
} from '../types'

interface TauriStreamEvent {
  type: string
  data: string
  session_id: string
}

const config: AgentConfig = {
  id: 'claude-code',
  type: 'local',
  name: 'Claude Code',
  description: "Anthropic's AI coding assistant",
  provider: 'Anthropic',
  installUrl: 'https://docs.anthropic.com/en/docs/claude-code',
  authCommand: 'claude login',
}

/**
 * Build a prompt string from message history
 */
function buildPromptFromMessages(
  messages: AgentMessage[],
  systemPrompt?: string
): string {
  let contextPrompt = ''

  // Add system prompt if provided
  if (systemPrompt) {
    contextPrompt = `<system>\n${systemPrompt}\n</system>\n\n`
  }

  // Add conversation history (excluding the last message)
  if (messages.length > 1) {
    contextPrompt += '<conversation_history>\n'
    for (const msg of messages.slice(0, -1)) {
      contextPrompt += `<${msg.role}>\n${msg.content}\n</${msg.role}>\n`
    }
    contextPrompt += '</conversation_history>\n\n'
  }

  // Add the latest user message
  const latestMessage = messages[messages.length - 1]
  return contextPrompt + (latestMessage?.content || '')
}

/**
 * Parse a single line of Claude Code JSONL output
 */
function parseClaudeCodeOutput(line: string): StreamEvent | null {
  if (!line.trim()) return null

  try {
    const event = JSON.parse(line)

    // Handle assistant message with content blocks
    // NOTE: Skip text blocks here - they duplicate content from content_block_delta events
    // Only process tool_use blocks from assistant messages
    if (event.type === 'assistant' && event.message?.content) {
      for (const block of event.message.content) {
        // Skip text blocks - we get these incrementally via content_block_delta
        // Skip thinking blocks - we get these incrementally via content_block_delta
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use',
            toolName: block.name,
            toolId: block.id,
            toolInput: block.input,
            content: JSON.stringify(block.input),
          }
        }
      }
    }

    // Handle content block delta (streaming)
    if (event.type === 'content_block_delta') {
      const delta = event.delta
      // Handle text deltas (can be delta.text or delta.type === 'text_delta')
      if (delta?.text) {
        return { type: 'text', content: delta.text }
      }
      // Handle thinking deltas (can be delta.thinking or delta.type === 'thinking_delta')
      if (delta?.thinking) {
        return { type: 'thinking', content: delta.thinking }
      }
      // Alternative format: delta.type specifies the content type
      if (delta?.type === 'text_delta' && delta?.text) {
        return { type: 'text', content: delta.text }
      }
      if (delta?.type === 'thinking_delta' && delta?.thinking) {
        return { type: 'thinking', content: delta.thinking }
      }
      // Handle input_json_delta for tool inputs
      if (delta?.type === 'input_json_delta' && delta?.partial_json) {
        // Tool input is being streamed - we'll get the full input in content_block_stop
        return null
      }
    }

    // Handle content block start (for tool use)
    if (event.type === 'content_block_start' && event.content_block) {
      const block = event.content_block
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          toolName: block.name,
          toolId: block.id,
          toolInput: block.input || {},
        }
      } else if (block.type === 'thinking') {
        return { type: 'thinking', content: block.thinking || '' }
      }
    }

    // Handle tool result
    if (event.type === 'tool_result') {
      return {
        type: 'tool_result',
        toolId: event.tool_use_id,
        toolResult:
          typeof event.content === 'string'
            ? event.content
            : JSON.stringify(event.content),
      }
    }

    // Handle final result
    if (event.type === 'result' && event.result) {
      return { type: 'text', content: event.result }
    }

    // Handle user message (contains tool results from Claude Code)
    if (event.type === 'user' && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === 'tool_result') {
          return {
            type: 'tool_result',
            toolId: block.tool_use_id,
            toolResult:
              typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content),
          }
        }
      }
    }

    return null
  } catch {
    // Not JSON, treat as plain text
    if (line.trim()) {
      return { type: 'text', content: line + '\n' }
    }
    return null
  }
}

export const claudeCodeAdapter: AgentAdapter = {
  id: 'claude-code',
  config,

  async checkStatus(): Promise<AgentStatus> {
    try {
      const status = await invoke<AgentStatus>('check_agent', {
        agentId: 'claude-code',
      })
      return status
    } catch (error) {
      return {
        installed: false,
        authenticated: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check Claude Code status',
      }
    }
  },

  async sendMessage(
    messages: AgentMessage[],
    options?: SendMessageOptions
  ): Promise<string> {
    const { systemPrompt, onStream, workingDirectory } = options || {}
    const prompt = buildPromptFromMessages(messages, systemPrompt)
    const sessionId = crypto.randomUUID()

    let fullResponse = ''
    let unlisten: UnlistenFn | null = null

    try {
      // Set up listener for stream events BEFORE invoking
      unlisten = await listen<TauriStreamEvent>('claude-stream', (event) => {
        const payload = event.payload

        // Only process events for our session
        if (payload.session_id !== sessionId) return

        if (payload.type === 'line' && payload.data) {
          // Parse the JSON line from stream-json output
          const streamEvent = parseClaudeCodeOutput(payload.data)
          if (streamEvent) {
            onStream?.(streamEvent)
            if (streamEvent.type === 'text' && streamEvent.content) {
              fullResponse += streamEvent.content
            }
          }
        } else if (payload.type === 'done') {
          onStream?.({ type: 'done' })
        }
      })

      // Invoke the streaming command
      // Note: Claude Code doesn't support model selection - it uses its own model
      const result = await invoke<CommandResult>('run_claude_code_streaming', {
        prompt,
        sessionId,
        planMode: false,
        thinkingEnabled: true,
        workingDirectory: workingDirectory || null,
      })

      // Clean up listener
      if (unlisten) {
        unlisten()
        unlisten = null
      }

      if (!result.success) {
        onStream?.({
          type: 'error',
          content: result.stderr || 'Claude Code command failed',
        })
        throw new Error(result.stderr || 'Claude Code command failed')
      }

      // If we didn't get streaming events, fall back to parsing the full output
      if (!fullResponse && result.stdout) {
        const lines = result.stdout.split('\n')
        for (const line of lines) {
          const event = parseClaudeCodeOutput(line)
          if (event) {
            onStream?.(event)
            if (event.type === 'text' && event.content) {
              fullResponse += event.content
            }
          }
        }
        onStream?.({ type: 'done' })
      }

      return fullResponse.trim() || result.stdout
    } catch (error) {
      // Clean up listener on error
      if (unlisten) {
        unlisten()
      }
      onStream?.({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  },

  parseOutput: parseClaudeCodeOutput,
}
