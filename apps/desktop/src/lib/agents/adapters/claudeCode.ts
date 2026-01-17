/**
 * Claude Code Adapter
 *
 * Integrates Anthropic's Claude Code CLI into the multi-agent system.
 * Uses JSONL output format for streaming responses.
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  AgentAdapter,
  AgentConfig,
  AgentMessage,
  AgentStatus,
  CommandResult,
  StreamEvent,
  SendMessageOptions,
} from '../types'

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
    if (event.type === 'assistant' && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === 'text') {
          return { type: 'text', content: block.text }
        } else if (block.type === 'thinking') {
          return { type: 'thinking', content: block.thinking }
        } else if (block.type === 'tool_use') {
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
      if (event.delta?.text) {
        return { type: 'text', content: event.delta.text }
      } else if (event.delta?.thinking) {
        return { type: 'thinking', content: event.delta.thinking }
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
    const { systemPrompt, onStream } = options || {}
    const prompt = buildPromptFromMessages(messages, systemPrompt)

    try {
      // Note: Claude Code doesn't support model selection - it uses its own model
      const result = await invoke<CommandResult>('run_agent', {
        agentId: 'claude-code',
        prompt,
        model: null,
      })

      if (!result.success) {
        onStream?.({
          type: 'error',
          content: result.stderr || 'Claude Code command failed',
        })
        throw new Error(result.stderr || 'Claude Code command failed')
      }

      // Parse JSONL output and emit stream events
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

  parseOutput: parseClaudeCodeOutput,
}
