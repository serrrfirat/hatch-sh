/**
 * Opencode Adapter
 *
 * Integrates the open-source Opencode AI agent into the multi-agent system.
 * Opencode supports the Agent Client Protocol (ACP) with JSON-RPC communication.
 *
 * Uses streaming via Tauri events for real-time tool feedback.
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
 * Opencode uses streaming JSON events with these types:
 * - text: Text responses with content in part.text
 * - tool_use: Tool calls with info in part.tool, part.state
 * - step_start/step_finish: Step boundaries
 */
function parseOpencodeOutput(line: string): StreamEvent | null {
  if (!line.trim()) return null

  try {
    const data = JSON.parse(line)

    // Handle opencode streaming event format
    // Events have { type, timestamp, sessionID, part }
    if (data.type && data.part) {
      const part = data.part

      // Text event: { type: "text", part: { type: "text", text: "..." } }
      if (data.type === 'text' && part.text) {
        return { type: 'text', content: part.text }
      }

      // Tool use event: { type: "tool_use", part: { type: "tool", tool: "bash", callID: "...", state: {...} } }
      if (data.type === 'tool_use' && part.type === 'tool') {
        const toolName = part.tool || 'unknown'
        const toolId = part.callID || String(Date.now())
        const toolInput = part.state?.input || {}
        const toolOutput = part.state?.output
        const status = part.state?.status

        // If tool is completed, return as tool_result
        if (status === 'completed' && toolOutput !== undefined) {
          return {
            type: 'tool_result',
            toolId,
            toolResult: typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput),
          }
        }

        // Otherwise return as tool_use (starting)
        return {
          type: 'tool_use',
          toolName,
          toolId,
          toolInput,
        }
      }

      // Thinking/reasoning event (if opencode supports it)
      if (part.type === 'reasoning' || part.type === 'thinking') {
        return { type: 'thinking', content: part.text || '' }
      }
    }

    // Legacy JSON-RPC format (fallback)
    if (data.result) {
      const result = data.result
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
        }
      }
      if (typeof result === 'string') {
        return { type: 'text', content: result }
      }
    }

    // Handle error responses
    if (data.error) {
      return {
        type: 'error',
        content: data.error.message || 'Opencode error',
      }
    }

    // Debug event (from our Rust code)
    if (data.type === 'debug') {
      console.log('[opencode] Debug:', data.command || data)
      return null // Don't show debug events to user
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
    const { systemPrompt, onStream, model, workingDirectory } = options || {}
    const prompt = buildPromptFromMessages(messages, systemPrompt)
    const sessionId = crypto.randomUUID()

    let fullResponse = ''
    let unlisten: UnlistenFn | null = null

    try {
      // Set up listener for stream events BEFORE invoking
      unlisten = await listen<TauriStreamEvent>('opencode-stream', (event) => {
        const payload = event.payload

        // Only process events for our session
        if (payload.session_id !== sessionId) return

        if (payload.type === 'line' && payload.data) {
          // Opencode may output multiple JSON objects on the same line
          // Split by '} {' to handle this case
          const jsonObjects = payload.data.split(/\}\s*\{/).map((part: string, index: number, arr: string[]) => {
            if (arr.length === 1) return part
            if (index === 0) return part + '}'
            if (index === arr.length - 1) return '{' + part
            return '{' + part + '}'
          })

          for (const jsonStr of jsonObjects) {
            // Use parseOpencodeOutput directly to avoid `this` binding issues
            const streamEvent = parseOpencodeOutput(jsonStr)
            if (streamEvent) {
              onStream?.(streamEvent)
              if (streamEvent.type === 'text' && streamEvent.content) {
                fullResponse += streamEvent.content
              }
            }
          }
        } else if (payload.type === 'stderr' && payload.data) {
          // Handle stderr output - could be debug info or errors
          // Try to parse as JSON first, otherwise treat as text
          const streamEvent = parseOpencodeOutput(payload.data)
          if (streamEvent) {
            onStream?.(streamEvent)
          } else {
            // Emit raw stderr as text so user can see what's happening
            onStream?.({ type: 'text', content: payload.data + '\n' })
            fullResponse += payload.data + '\n'
          }
        } else if (payload.type === 'error' && payload.data) {
          console.error('[opencode-stream] error:', payload.data)
          onStream?.({ type: 'error', content: payload.data })
        } else if (payload.type === 'done') {
          onStream?.({ type: 'done' })
        }
      })

      // Invoke the streaming command
      const result = await invoke<CommandResult>('run_opencode_streaming', {
        prompt,
        sessionId,
        model: model || null,
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
          content: result.stderr || 'Opencode command failed',
        })
        throw new Error(result.stderr || 'Opencode command failed')
      }

      // If we didn't get streaming events, fall back to parsing the full output
      if (!fullResponse && result.stdout) {
        const lines = result.stdout.split('\n')
        for (const line of lines) {
          const event = parseOpencodeOutput(line)
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

  parseOutput: parseOpencodeOutput,
}
