/**
 * Cursor Agent Adapter
 *
 * Integrates Cursor's AI agent CLI into the multi-agent system.
 * Uses NDJSON (newline-delimited JSON) streaming output format.
 *
 * CLI command: `agent chat "<prompt>" -p --output-format stream-json`
 * Requires: CURSOR_API_KEY environment variable
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  AgentAdapter,
  AgentConfig,
  AgentMessage,
  AgentStatus,
  CommandResult,
  StreamEvent,
} from '../types'

const config: AgentConfig = {
  id: 'cursor',
  name: 'Cursor Agent',
  description: "Cursor's AI agent for code editing",
  installUrl: 'https://cursor.com/docs/cli',
  authCommand: 'agent login',
}

/**
 * Build a prompt string from message history for Cursor
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
 * Parse a single line of Cursor Agent NDJSON output
 *
 * Cursor Agent emits events like:
 * - {"type": "system_init", "session_id": "..."}
 * - {"type": "assistant_message", "delta": "..."}
 * - {"type": "tool_call", "tool": "...", "args": {...}}
 * - {"type": "tool_result", "content": "..."}
 * - {"type": "completion", "status": "success"}
 */
function parseCursorOutput(line: string): StreamEvent | null {
  if (!line.trim()) return null

  try {
    const data = JSON.parse(line)

    // Handle assistant message (streaming text)
    if (data.type === 'assistant_message') {
      if (data.delta) {
        return { type: 'text', content: data.delta }
      }
      if (data.content) {
        return { type: 'text', content: data.content }
      }
    }

    // Handle assistant start (may include thinking)
    if (data.type === 'assistant_start') {
      // Just acknowledge, no content yet
      return null
    }

    // Handle thinking/reasoning
    if (data.type === 'thinking' || data.type === 'reasoning') {
      return { type: 'thinking', content: data.content || data.delta }
    }

    // Handle tool call
    if (data.type === 'tool_call') {
      return {
        type: 'tool_use',
        toolName: data.tool,
        toolId: data.id || String(Date.now()),
        toolInput: data.args || data.input || {},
      }
    }

    // Handle tool result
    if (data.type === 'tool_result') {
      return {
        type: 'tool_result',
        toolId: data.tool_call_id || data.id,
        toolResult:
          typeof data.content === 'string'
            ? data.content
            : JSON.stringify(data.content),
      }
    }

    // Handle completion
    if (data.type === 'completion') {
      if (data.status === 'error') {
        return { type: 'error', content: data.error || 'Cursor agent error' }
      }
      return { type: 'done' }
    }

    // Handle error events
    if (data.type === 'error') {
      return { type: 'error', content: data.message || data.error || 'Error' }
    }

    // Handle user message echo (ignore)
    if (data.type === 'user_message') {
      return null
    }

    // Handle system init (ignore)
    if (data.type === 'system_init') {
      return null
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

export const cursorAdapter: AgentAdapter = {
  id: 'cursor',
  config,

  async checkStatus(): Promise<AgentStatus> {
    try {
      const status = await invoke<AgentStatus>('check_agent', {
        agentId: 'cursor',
      })
      return status
    } catch (error) {
      return {
        installed: false,
        authenticated: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check Cursor Agent status',
      }
    }
  },

  async sendMessage(
    messages: AgentMessage[],
    systemPrompt?: string,
    onStream?: (event: StreamEvent) => void
  ): Promise<string> {
    const prompt = buildPromptFromMessages(messages, systemPrompt)

    try {
      const result = await invoke<CommandResult>('run_agent', {
        agentId: 'cursor',
        prompt,
      })

      if (!result.success) {
        onStream?.({
          type: 'error',
          content: result.stderr || 'Cursor Agent command failed',
        })
        throw new Error(result.stderr || 'Cursor Agent command failed')
      }

      // Parse NDJSON output and emit stream events
      let fullResponse = ''
      const lines = result.stdout.split('\n')

      for (const line of lines) {
        const event = this.parseOutput(line)
        if (event) {
          onStream?.(event)
          if (event.type === 'text' && event.content) {
            fullResponse += event.content
          }
        }
      }

      onStream?.({ type: 'done' })
      return fullResponse.trim() || result.stdout
    } catch (error) {
      onStream?.({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  },

  parseOutput: parseCursorOutput,
}
