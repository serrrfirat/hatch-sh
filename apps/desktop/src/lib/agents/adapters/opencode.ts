/**
 * Opencode Adapter
 *
 * Integrates the open-source Opencode AI agent into the multi-agent system.
 * Opencode supports the Agent Client Protocol (ACP) with JSON-RPC communication.
 *
 * For initial implementation, we use a simpler CLI-based approach.
 * Future enhancement: Full ACP JSON-RPC protocol support.
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
  id: 'opencode',
  type: 'local',
  name: 'Opencode',
  description: 'Open-source AI coding agent with ACP protocol',
  provider: 'Open Source',
  installUrl: 'https://github.com/anomalyco/opencode',
  authCommand: 'opencode auth login --provider anthropic',
}

/**
 * Build a prompt string from message history for Opencode
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
 * Parse a single line of Opencode output
 *
 * Opencode ACP uses JSON-RPC format. This parser handles:
 * - Text responses
 * - Tool calls (file edits, commands)
 * - Reasoning/thinking blocks
 */
function parseOpencodeOutput(line: string): StreamEvent | null {
  if (!line.trim()) return null

  try {
    const data = JSON.parse(line)

    // Handle JSON-RPC response format
    if (data.result) {
      const result = data.result

      // Handle message parts from ACP prompt response
      if (result.message?.parts) {
        for (const part of result.message.parts) {
          if (part.type === 'text') {
            return { type: 'text', content: part.text }
          }
          if (part.type === 'reasoning') {
            return { type: 'thinking', content: part.text }
          }
          if (part.type === 'tool') {
            return {
              type: 'tool_use',
              toolName: part.name,
              toolId: part.id || String(Date.now()),
              toolInput: part.input,
            }
          }
          if (part.type === 'file') {
            return {
              type: 'tool_use',
              toolName: 'file_edit',
              toolId: part.path,
              toolInput: { path: part.path, content: part.content },
            }
          }
        }
      }

      // Handle simple text result
      if (typeof result === 'string') {
        return { type: 'text', content: result }
      }
    }

    // Handle notification events (session updates, etc.)
    if (data.method === 'session/update') {
      const params = data.params
      if (params?.delta?.text) {
        return { type: 'text', content: params.delta.text }
      }
      if (params?.delta?.thinking) {
        return { type: 'thinking', content: params.delta.thinking }
      }
    }

    // Handle error responses
    if (data.error) {
      return {
        type: 'error',
        content: data.error.message || 'Opencode error',
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

export const opencodeAdapter: AgentAdapter = {
  id: 'opencode',
  config,

  async checkStatus(): Promise<AgentStatus> {
    try {
      const status = await invoke<AgentStatus>('check_agent', {
        agentId: 'opencode',
      })
      return status
    } catch (error) {
      return {
        installed: false,
        authenticated: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check Opencode status',
      }
    }
  },

  async sendMessage(
    messages: AgentMessage[],
    options?: SendMessageOptions
  ): Promise<string> {
    const { systemPrompt, onStream, model } = options || {}
    const prompt = buildPromptFromMessages(messages, systemPrompt)

    try {
      const result = await invoke<CommandResult>('run_agent', {
        agentId: 'opencode',
        prompt,
        model: model || null,
      })

      if (!result.success) {
        onStream?.({
          type: 'error',
          content: result.stderr || 'Opencode command failed',
        })
        throw new Error(result.stderr || 'Opencode command failed')
      }

      // Parse output and emit stream events
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

  parseOutput: parseOpencodeOutput,
}
