import { Command } from '@tauri-apps/plugin-shell'

export interface ClaudeCodeStatus {
  installed: boolean
  authenticated: boolean
  version?: string
  error?: string
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
    // Check if claude command exists
    const whichCmd = Command.create('which', ['claude'])
    const whichResult = await whichCmd.execute()

    if (whichResult.code !== 0) {
      return {
        installed: false,
        authenticated: false,
        error: 'Claude Code is not installed. Install it from https://claude.ai/download'
      }
    }

    // Get version to verify it's working
    const versionCmd = Command.create('claude', ['--version'])
    const versionResult = await versionCmd.execute()

    if (versionResult.code !== 0) {
      return {
        installed: true,
        authenticated: false,
        error: 'Claude Code is installed but not responding correctly'
      }
    }

    const version = versionResult.stdout.trim()

    // Check authentication status by running a simple command
    // Claude Code will fail with auth error if not logged in
    const authCheckCmd = Command.create('claude', ['--print', '--output-format', 'json', 'Say "ok"'])
    const authResult = await authCheckCmd.execute()

    if (authResult.code !== 0) {
      const stderr = authResult.stderr.toLowerCase()
      if (stderr.includes('auth') || stderr.includes('login') || stderr.includes('credential')) {
        return {
          installed: true,
          authenticated: false,
          version,
          error: 'Claude Code is not authenticated. Run "claude login" in your terminal'
        }
      }
      return {
        installed: true,
        authenticated: false,
        version,
        error: authResult.stderr || 'Unknown authentication error'
      }
    }

    return {
      installed: true,
      authenticated: true,
      version
    }
  } catch (error) {
    return {
      installed: false,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Failed to check Claude Code status'
    }
  }
}

/**
 * Send a message to Claude Code and stream the response
 */
export async function sendToClaudeCode(
  prompt: string,
  systemPrompt?: string,
  onStream?: (event: StreamEvent) => void
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Build the full prompt with system context
      const fullPrompt = systemPrompt
        ? `<system>\n${systemPrompt}\n</system>\n\n${prompt}`
        : prompt

      // Create the command with streaming output
      const cmd = Command.create('claude', [
        '--print',
        '--output-format', 'stream-json',
        fullPrompt
      ])

      let fullResponse = ''
      let currentText = ''

      // Handle stdout for streaming
      cmd.stdout.on('data', (line: string) => {
        try {
          // Each line is a JSON event
          const event = JSON.parse(line)

          if (event.type === 'assistant') {
            // Assistant message content
            if (event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'text') {
                  currentText += block.text
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
            }
          } else if (event.type === 'content_block_delta') {
            // Streaming text delta
            if (event.delta?.text) {
              currentText += event.delta.text
              fullResponse += event.delta.text
              onStream?.({ type: 'text', content: event.delta.text })
            }
          } else if (event.type === 'content_block_start') {
            // New content block starting
            if (event.content_block?.type === 'text') {
              // Text block starting
            }
          } else if (event.type === 'message_stop' || event.type === 'result') {
            // Message complete
            onStream?.({ type: 'done' })
          } else if (event.type === 'error') {
            onStream?.({ type: 'error', content: event.error?.message || 'Unknown error' })
          }
        } catch {
          // Line might not be JSON, treat as plain text
          if (line.trim()) {
            fullResponse += line
            onStream?.({ type: 'text', content: line })
          }
        }
      })

      // Handle stderr for errors
      cmd.stderr.on('data', (line: string) => {
        console.error('[Claude Code stderr]:', line)
        // Don't treat all stderr as errors - some might be warnings
        if (line.toLowerCase().includes('error')) {
          onStream?.({ type: 'error', content: line })
        }
      })

      // Execute and wait for completion
      const result = await cmd.execute()

      if (result.code !== 0 && !fullResponse) {
        reject(new Error(result.stderr || 'Claude Code command failed'))
        return
      }

      // If we got stdout directly (non-streaming fallback)
      if (!fullResponse && result.stdout) {
        fullResponse = result.stdout
        onStream?.({ type: 'text', content: result.stdout })
        onStream?.({ type: 'done' })
      }

      resolve(fullResponse)
    } catch (error) {
      reject(error)
    }
  })
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
 * Open Claude Code login in terminal
 */
export async function openClaudeCodeLogin(): Promise<void> {
  // Open a terminal and run claude login
  // This varies by platform
  const cmd = Command.create('open', ['-a', 'Terminal'])
  await cmd.execute()

  // Give terminal time to open, then we can't really run claude login automatically
  // User needs to do this manually
}
