import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface ClaudeCodeStatus {
  installed: boolean
  authenticated: boolean
  version?: string
  error?: string
}

interface CommandResult {
  success: boolean
  stdout: string
  stderr: string
  code?: number
}

export interface ToolUseEvent {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
}

export interface StreamEvent {
  type: 'text' | 'code' | 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'done'
  content?: string
  language?: string
  toolName?: string
  toolId?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
}

export interface StreamingOptions {
  /** Enable plan mode - Claude will create plans before executing */
  planMode?: boolean
  /** Enable extended thinking - shows Claude's reasoning */
  thinkingEnabled?: boolean
  /** Working directory for Claude Code to run in */
  workingDirectory?: string
}

/**
 * Check if Claude Code is installed and authenticated
 */
export async function checkClaudeCodeStatus(): Promise<ClaudeCodeStatus> {
  try {
    const status = await invoke<ClaudeCodeStatus>('check_claude_code')
    return status
  } catch (error) {
    return {
      installed: false,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Failed to check Claude Code status'
    }
  }
}

/**
 * Send a message to Claude Code and get the response
 */
export async function sendToClaudeCode(
  prompt: string,
  systemPrompt?: string,
  onStream?: (event: StreamEvent) => void
): Promise<string> {
  // Build the full prompt with system context
  const fullPrompt = systemPrompt
    ? `<system>\n${systemPrompt}\n</system>\n\n${prompt}`
    : prompt

  try {
    const result = await invoke<CommandResult>('run_claude_code', { prompt: fullPrompt })

    if (!result.success) {
      onStream?.({ type: 'error', content: result.stderr || 'Claude Code command failed' })
      throw new Error(result.stderr || 'Claude Code command failed')
    }

    // Parse the response
    let fullResponse = ''
    const lines = result.stdout.split('\n')

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const event = JSON.parse(line)

        // Handle assistant message with content blocks
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text') {
              fullResponse += block.text
              onStream?.({ type: 'text', content: block.text })
            } else if (block.type === 'thinking') {
              // Extended thinking block
              onStream?.({ type: 'thinking', content: block.thinking })
            } else if (block.type === 'tool_use') {
              onStream?.({
                type: 'tool_use',
                toolName: block.name,
                toolId: block.id,
                toolInput: block.input,
                content: JSON.stringify(block.input)
              })
            }
          }
        }
        // Handle content block delta (streaming)
        else if (event.type === 'content_block_delta') {
          if (event.delta?.text) {
            fullResponse += event.delta.text
            onStream?.({ type: 'text', content: event.delta.text })
          } else if (event.delta?.thinking) {
            onStream?.({ type: 'thinking', content: event.delta.thinking })
          }
        }
        // Handle content block start (for tool use)
        else if (event.type === 'content_block_start' && event.content_block) {
          const block = event.content_block
          if (block.type === 'tool_use') {
            onStream?.({
              type: 'tool_use',
              toolName: block.name,
              toolId: block.id,
              toolInput: block.input || {},
            })
          } else if (block.type === 'thinking') {
            onStream?.({ type: 'thinking', content: block.thinking || '' })
          }
        }
        // Handle tool result
        else if (event.type === 'tool_result') {
          onStream?.({
            type: 'tool_result',
            toolId: event.tool_use_id,
            toolResult: typeof event.content === 'string' ? event.content : JSON.stringify(event.content),
          })
        }
        // Handle final result
        else if (event.type === 'result' && event.result) {
          fullResponse = event.result
          onStream?.({ type: 'text', content: event.result })
        }
      } catch {
        // Not JSON, might be plain text response
        if (line.trim()) {
          fullResponse += line + '\n'
          onStream?.({ type: 'text', content: line + '\n' })
        }
      }
    }

    onStream?.({ type: 'done' })
    return fullResponse.trim() || result.stdout
  } catch (error) {
    onStream?.({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' })
    throw error
  }
}

/**
 * Send a message with conversation history
 */
export async function sendWithHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt?: string,
  onStream?: (event: StreamEvent) => void
): Promise<string> {
  // Build a prompt that includes conversation history
  let contextPrompt = ''

  if (messages.length > 1) {
    // Include previous messages as context
    const history = messages.slice(0, -1)
    contextPrompt = '<conversation_history>\n'
    for (const msg of history) {
      contextPrompt += `<${msg.role}>\n${msg.content}\n</${msg.role}>\n`
    }
    contextPrompt += '</conversation_history>\n\n'
  }

  // Get the latest user message
  const latestMessage = messages[messages.length - 1]
  const fullPrompt = contextPrompt + latestMessage.content

  return sendToClaudeCode(fullPrompt, systemPrompt, onStream)
}

/**
 * Open Claude Code download page
 */
export function openClaudeDownload(): void {
  window.open('https://claude.ai/download', '_blank')
}

interface TauriStreamEvent {
  type: string
  data: string
  session_id: string
}

/**
 * Send a message to Claude Code with real-time streaming via Tauri events
 */
export async function sendToClaudeCodeStreaming(
  prompt: string,
  systemPrompt?: string,
  onStream?: (event: StreamEvent) => void,
  options?: StreamingOptions
): Promise<string> {
  const sessionId = crypto.randomUUID()

  // Build the full prompt with system context
  const fullPrompt = systemPrompt
    ? `<system>\n${systemPrompt}\n</system>\n\n${prompt}`
    : prompt

  let fullResponse = ''
  let unlisten: UnlistenFn | null = null

  // Extract options with defaults
  const planMode = options?.planMode ?? false
  const thinkingEnabled = options?.thinkingEnabled ?? true
  const workingDirectory = options?.workingDirectory

  try {
    // Set up listener for stream events BEFORE invoking
    unlisten = await listen<TauriStreamEvent>('claude-stream', (event) => {
      const payload = event.payload

      // Debug logging

      // Only process events for our session
      if (payload.session_id !== sessionId) return

      if (payload.type === 'line' && payload.data) {
        // Parse the JSON line from stream-json output
        try {
          const jsonEvent = JSON.parse(payload.data)

          // Handle assistant message with content blocks
          if (jsonEvent.type === 'assistant' && jsonEvent.message?.content) {
            for (const block of jsonEvent.message.content) {
              if (block.type === 'text') {
                fullResponse += block.text
                onStream?.({ type: 'text', content: block.text })
              } else if (block.type === 'thinking') {
                onStream?.({ type: 'thinking', content: block.thinking })
              } else if (block.type === 'tool_use') {
                onStream?.({
                  type: 'tool_use',
                  toolName: block.name,
                  toolId: block.id,
                  toolInput: block.input,
                  content: JSON.stringify(block.input)
                })
              }
            }
          }
          // Handle content block delta (streaming text)
          else if (jsonEvent.type === 'content_block_delta') {
            if (jsonEvent.delta?.text) {
              fullResponse += jsonEvent.delta.text
              onStream?.({ type: 'text', content: jsonEvent.delta.text })
            } else if (jsonEvent.delta?.thinking) {
              onStream?.({ type: 'thinking', content: jsonEvent.delta.thinking })
            }
          }
          // Handle content block start (for tool use)
          else if (jsonEvent.type === 'content_block_start' && jsonEvent.content_block) {
            const block = jsonEvent.content_block
            if (block.type === 'tool_use') {
              onStream?.({
                type: 'tool_use',
                toolName: block.name,
                toolId: block.id,
                toolInput: block.input || {},
              })
            } else if (block.type === 'thinking') {
              onStream?.({ type: 'thinking', content: block.thinking || '' })
            }
          }
          // Handle tool result
          else if (jsonEvent.type === 'tool_result') {
            onStream?.({
              type: 'tool_result',
              toolId: jsonEvent.tool_use_id,
              toolResult: typeof jsonEvent.content === 'string'
                ? jsonEvent.content
                : JSON.stringify(jsonEvent.content),
            })
          }
          // Handle final result
          else if (jsonEvent.type === 'result' && jsonEvent.result) {
            fullResponse = jsonEvent.result
            onStream?.({ type: 'text', content: jsonEvent.result })
          }
          // Handle user message (contains tool results)
          else if (jsonEvent.type === 'user' && jsonEvent.message?.content) {
            for (const block of jsonEvent.message.content) {
              if (block.type === 'tool_result') {
                onStream?.({
                  type: 'tool_result',
                  toolId: block.tool_use_id,
                  toolResult: typeof block.content === 'string'
                    ? block.content
                    : JSON.stringify(block.content),
                })
              }
            }
          }
        } catch {
          // Not valid JSON, treat as plain text
          if (payload.data.trim()) {
            fullResponse += payload.data + '\n'
            onStream?.({ type: 'text', content: payload.data + '\n' })
          }
        }
      } else if (payload.type === 'done') {
        onStream?.({ type: 'done' })
      }
    })

    // Start the streaming command
    await invoke('run_claude_code_streaming', {
      prompt: fullPrompt,
      sessionId,
      planMode,
      thinkingEnabled,
      workingDirectory
    })

    return fullResponse.trim()
  } catch (error) {
    onStream?.({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' })
    throw error
  } finally {
    // Clean up listener
    if (unlisten) {
      unlisten()
    }
  }
}

/**
 * Send a message with conversation history using streaming
 */
export async function sendWithHistoryStreaming(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt?: string,
  onStream?: (event: StreamEvent) => void,
  options?: StreamingOptions
): Promise<string> {
  // Build a prompt that includes conversation history
  let contextPrompt = ''

  if (messages.length > 1) {
    // Include previous messages as context
    const history = messages.slice(0, -1)
    contextPrompt = '<conversation_history>\n'
    for (const msg of history) {
      contextPrompt += `<${msg.role}>\n${msg.content}\n</${msg.role}>\n`
    }
    contextPrompt += '</conversation_history>\n\n'
  }

  // Get the latest user message
  const latestMessage = messages[messages.length - 1]
  const fullPrompt = contextPrompt + latestMessage.content

  return sendToClaudeCodeStreaming(fullPrompt, systemPrompt, onStream, options)
}
