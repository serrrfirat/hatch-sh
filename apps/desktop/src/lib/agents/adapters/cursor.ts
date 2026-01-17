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
  SendMessageOptions,
} from '../types'

const config: AgentConfig = {
  id: 'cursor',
  type: 'local',
  name: 'Cursor Agent',
  description: "Cursor's AI agent for code editing",
  provider: 'Cursor',
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
 * Parse a single JSON object from Cursor Agent output
 *
 * Cursor Agent emits events like:
 * - {"type":"system","subtype":"init",...} - system init
 * - {"type":"user","message":{...}} - user message echo
 * - {"type":"thinking","subtype":"delta","text":"..."} - thinking
 * - {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}} - assistant text
 * - {"type":"tool_call","subtype":"started","call_id":"...","tool_call":{...}} - tool call start
 * - {"type":"tool_call","subtype":"completed","call_id":"...","tool_call":{...}} - tool call result
 * - {"type":"result","subtype":"success",...} - completion
 */
function parseCursorOutput(line: string): StreamEvent | null {
  if (!line.trim()) return null

  try {
    const data = JSON.parse(line)

    // Handle system init (ignore)
    if (data.type === 'system') {
      return null
    }

    // Handle user message echo (ignore)
    if (data.type === 'user') {
      return null
    }

    // Handle thinking events
    if (data.type === 'thinking') {
      if (data.subtype === 'delta' && data.text) {
        return { type: 'thinking', content: data.text }
      }
      // thinking completed - ignore
      return null
    }

    // Handle assistant message
    if (data.type === 'assistant' && data.message) {
      const content = data.message.content
      if (Array.isArray(content)) {
        // Extract text from content array
        const textParts = content
          .filter((part: { type: string }) => part.type === 'text')
          .map((part: { text: string }) => part.text)
          .join('')
        if (textParts) {
          return { type: 'text', content: textParts }
        }
      }
      return null
    }

    // Handle tool call events
    if (data.type === 'tool_call') {
      const callId = data.call_id || String(Date.now())
      const toolCall = data.tool_call || {}

      if (data.subtype === 'started') {
        // Extract tool name and input from the tool_call object
        // Format: { readToolCall: { args: {...} } } or { bashToolCall: { args: {...} } }
        const toolType = Object.keys(toolCall)[0] || 'unknown'
        const toolName = toolType.replace('ToolCall', '').replace(/([A-Z])/g, ' $1').trim()
        const toolData = toolCall[toolType] || {}
        const toolInput = toolData.args || {}

        return {
          type: 'tool_use',
          toolName,
          toolId: callId,
          toolInput,
        }
      }

      if (data.subtype === 'completed') {
        // Extract result from the tool_call object
        const toolType = Object.keys(toolCall)[0] || 'unknown'
        const toolData = toolCall[toolType] || {}
        const result = toolData.result

        if (result) {
          // Handle success/error results
          const resultContent = result.success || result.error
          const resultStr = typeof resultContent === 'string'
            ? resultContent
            : resultContent?.content || JSON.stringify(resultContent)

          return {
            type: 'tool_result',
            toolId: callId,
            toolResult: resultStr,
          }
        }
        return null
      }
    }

    // Handle result/completion
    if (data.type === 'result') {
      if (data.subtype === 'error' || data.is_error) {
        return { type: 'error', content: data.result || 'Cursor agent error' }
      }
      // Success result may contain the full response
      if (data.result && typeof data.result === 'string') {
        return { type: 'text', content: data.result }
      }
      return { type: 'done' }
    }

    // Handle error events
    if (data.type === 'error') {
      return { type: 'error', content: data.message || data.error || 'Error' }
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
    options?: SendMessageOptions
  ): Promise<string> {
    const { systemPrompt, onStream, model, workingDirectory } = options || {}
    const prompt = buildPromptFromMessages(messages, systemPrompt)

    try {
      const result = await invoke<CommandResult>('run_agent', {
        agentId: 'cursor',
        prompt,
        model: model || null,
        workingDirectory: workingDirectory || null,
      })

      if (!result.success) {
        onStream?.({
          type: 'error',
          content: result.stderr || 'Cursor Agent command failed',
        })
        throw new Error(result.stderr || 'Cursor Agent command failed')
      }

      // Parse NDJSON output and emit stream events
      // Cursor outputs multiple JSON objects, possibly on same line or separate lines
      let fullResponse = ''
      const stdout = result.stdout

      // Extract JSON objects using brace matching (handles nested objects)
      const jsonObjects: string[] = []
      let braceCount = 0
      let currentObj = ''
      let inString = false
      let escapeNext = false

      for (const char of stdout) {
        if (escapeNext) {
          currentObj += char
          escapeNext = false
          continue
        }

        if (char === '\\' && inString) {
          currentObj += char
          escapeNext = true
          continue
        }

        if (char === '"' && !escapeNext) {
          inString = !inString
        }

        if (!inString) {
          if (char === '{') {
            if (braceCount === 0) currentObj = ''
            braceCount++
          }
          if (char === '}') {
            braceCount--
            if (braceCount === 0) {
              currentObj += char
              jsonObjects.push(currentObj)
              currentObj = ''
              continue
            }
          }
        }

        if (braceCount > 0) {
          currentObj += char
        }
      }

      for (const jsonStr of jsonObjects) {
        try {
          const event = parseCursorOutput(jsonStr)
          if (event) {
            onStream?.(event)
            if (event.type === 'text' && event.content) {
              fullResponse += event.content
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }

      // Fallback: if no text was extracted, try to find the result field directly
      if (!fullResponse.trim()) {
        // Look for the final result in the output
        const resultMatch = stdout.match(/"type"\s*:\s*"result"[^}]*"result"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/s)
        if (resultMatch && resultMatch[1]) {
          // Unescape the JSON string
          fullResponse = resultMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
        }
      }

      // Last resort: try to find any assistant message content
      if (!fullResponse.trim()) {
        const assistantMatch = stdout.match(/"type"\s*:\s*"assistant"[^}]*"text"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/s)
        if (assistantMatch && assistantMatch[1]) {
          fullResponse = assistantMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
        }
      }

      onStream?.({ type: 'done' })

      // Return parsed response, or error message if nothing was parsed
      if (fullResponse.trim()) {
        return fullResponse.trim()
      }

      // If we still have nothing, return a friendly error instead of raw JSON
      console.error('[cursor] Failed to parse response, raw output:', stdout.substring(0, 500))
      return 'Sorry, I encountered an issue processing the response. Please try again.'
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
