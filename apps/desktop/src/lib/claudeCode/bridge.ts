import { invoke } from '@tauri-apps/api/core'

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

export interface StreamEvent {
  type: 'text' | 'code' | 'tool_use' | 'error' | 'done'
  content?: string
  language?: string
  toolName?: string
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

        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text') {
              fullResponse += block.text
              onStream?.({ type: 'text', content: block.text })
            } else if (block.type === 'tool_use') {
              onStream?.({
                type: 'tool_use',
                toolName: block.name,
                content: JSON.stringify(block.input)
              })
            }
          }
        } else if (event.type === 'content_block_delta' && event.delta?.text) {
          fullResponse += event.delta.text
          onStream?.({ type: 'text', content: event.delta.text })
        } else if (event.type === 'result' && event.result) {
          // Final result - extract text content
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
