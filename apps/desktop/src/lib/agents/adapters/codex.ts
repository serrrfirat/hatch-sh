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
import { createLineBuffer, safeParseJsonLine } from '../streamUtils'

interface TauriStreamEvent {
  type: string
  data: string
  session_id: string
}

const config: AgentConfig = {
  id: 'codex',
  type: 'local',
  name: 'Codex CLI',
  description: 'OpenAI Codex local CLI agent',
  provider: 'OpenAI',
  installUrl: 'https://developers.openai.com/codex/cli',
  authCommand: 'codex login',
}

function buildPromptFromMessages(messages: AgentMessage[], systemPrompt?: string): string {
  let contextPrompt = ''

  if (systemPrompt) {
    contextPrompt = `<system>\n${systemPrompt}\n</system>\n\n`
  }

  if (messages.length > 1) {
    contextPrompt += '<conversation_history>\n'
    for (const msg of messages.slice(0, -1)) {
      contextPrompt += `<${msg.role}>\n${msg.content}\n</${msg.role}>\n`
    }
    contextPrompt += '</conversation_history>\n\n'
  }

  const latestMessage = messages[messages.length - 1]
  return contextPrompt + (latestMessage?.content || '')
}

function parseCodexOutput(line: string): StreamEvent | null {
  const parsed = safeParseJsonLine(line, 'codex')
  if (parsed.errorEvent) return parsed.errorEvent
  if (!parsed.value || typeof parsed.value !== 'object') {
    const trimmed = line.trim()
    return trimmed ? { type: 'text', content: trimmed } : null
  }

  const data = parsed.value as Record<string, unknown>
  const eventType = typeof data.type === 'string' ? data.type : null
  if (!eventType) return null

  if (eventType === 'turn.completed') {
    return { type: 'done' }
  }

  if (eventType === 'error') {
    const errorMessage =
      typeof data.message === 'string'
        ? data.message
        : typeof data.error === 'string'
          ? data.error
          : 'Codex CLI error'
    return { type: 'error', content: errorMessage }
  }

  if (eventType === 'item.started' || eventType === 'item.completed') {
    const item =
      data.item && typeof data.item === 'object' ? (data.item as Record<string, unknown>) : null
    if (!item) return null

    const itemType = typeof item.type === 'string' ? item.type : null
    const itemId = typeof item.id === 'string' ? item.id : `codex-${Date.now()}`

    if (itemType === 'agent_message' && eventType === 'item.completed') {
      if (typeof item.text === 'string' && item.text.trim().length > 0) {
        return { type: 'text', content: item.text }
      }
      if (typeof item.content === 'string' && item.content.trim().length > 0) {
        return { type: 'text', content: item.content }
      }
      return null
    }

    if (itemType === 'reasoning') {
      if (typeof item.text === 'string' && item.text.trim().length > 0) {
        return { type: 'thinking', content: item.text }
      }
      if (typeof item.summary === 'string' && item.summary.trim().length > 0) {
        return { type: 'thinking', content: item.summary }
      }
      return null
    }

    if (itemType === 'command_execution') {
      if (eventType === 'item.started') {
        return {
          type: 'tool_use',
          toolId: itemId,
          toolName: 'command_execution',
          toolInput: {
            command: typeof item.command === 'string' ? item.command : '',
          },
        }
      }

      const output =
        typeof item.output === 'string'
          ? item.output
          : typeof item.result === 'string'
            ? item.result
            : JSON.stringify(item)

      return {
        type: 'tool_result',
        toolId: itemId,
        toolResult: output,
      }
    }
  }

  return null
}

export const codexAdapter: AgentAdapter = {
  id: 'codex',
  config,

  async checkStatus(): Promise<AgentStatus> {
    try {
      return await invoke<AgentStatus>('check_agent', {
        agentId: 'codex',
      })
    } catch (error) {
      return {
        installed: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Failed to check Codex CLI status',
      }
    }
  },

  async sendMessage(messages: AgentMessage[], options?: SendMessageOptions): Promise<string> {
    const { systemPrompt, onStream, workingDirectory } = options || {}
    const prompt = buildPromptFromMessages(messages, systemPrompt)
    const sessionId = crypto.randomUUID()

    let fullResponse = ''
    let unlisten: UnlistenFn | null = null
    const stdoutBuffer = createLineBuffer()
    const stderrBuffer = createLineBuffer()

    try {
      unlisten = await listen<TauriStreamEvent>('codex-stream', (event) => {
        const payload = event.payload
        if (payload.session_id !== sessionId) return

        if (payload.type === 'line' && payload.data) {
          for (const line of stdoutBuffer.pushChunk(`${payload.data}\n`)) {
            const streamEvent = parseCodexOutput(line)
            if (streamEvent) {
              onStream?.(streamEvent)
              if (streamEvent.type === 'text' && streamEvent.content) {
                fullResponse += streamEvent.content
              }
            }
          }
        } else if (payload.type === 'stderr' && payload.data) {
          stderrBuffer.pushChunk(`${payload.data}\n`)
        } else if (payload.type === 'error' && payload.data) {
          onStream?.({ type: 'error', content: payload.data })
        } else if (payload.type === 'done') {
          for (const line of stdoutBuffer.flush()) {
            const streamEvent = parseCodexOutput(line)
            if (streamEvent) {
              onStream?.(streamEvent)
              if (streamEvent.type === 'text' && streamEvent.content) {
                fullResponse += streamEvent.content
              }
            }
          }
          stderrBuffer.flush()
          onStream?.({ type: 'done' })
        }
      })

      const result = await invoke<CommandResult>('run_codex_streaming', {
        prompt,
        sessionId,
        workingDirectory: workingDirectory || null,
      })

      if (unlisten) {
        unlisten()
        unlisten = null
      }

      if (!result.success) {
        onStream?.({ type: 'error', content: result.stderr || 'Codex CLI command failed' })
        throw new Error(result.stderr || 'Codex CLI command failed')
      }

      if (!fullResponse && result.stdout) {
        const lines = result.stdout.split('\n')
        for (const line of lines) {
          const event = parseCodexOutput(line)
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

  parseOutput: parseCodexOutput,
}
