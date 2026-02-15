import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { sendToClaudeCode } from '../../src/lib/claudeCode/bridge'

describe('agent harness streaming flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses text/thinking/tool events from Claude output', async () => {
    const stdout = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'analyzing' },
            { type: 'text', text: 'Hello ' },
            { type: 'tool_use', id: 'tool-1', name: 'read', input: { path: 'README.md' } },
          ],
        },
      }),
      JSON.stringify({
        type: 'tool_result',
        tool_use_id: 'tool-1',
        content: 'ok',
      }),
      JSON.stringify({
        type: 'content_block_delta',
        delta: { text: 'world' },
      }),
    ].join('\n')

    vi.mocked(invoke).mockResolvedValue({
      success: true,
      stdout,
      stderr: '',
      code: 0,
    })

    const events: string[] = []
    const result = await sendToClaudeCode('hi', 'system', (e) => {
      events.push(e.type)
    })

    expect(result).toContain('Hello world')
    expect(events).toEqual(
      expect.arrayContaining(['thinking', 'text', 'tool_use', 'tool_result', 'done'])
    )
  })

  it('surfaces command failure', async () => {
    vi.mocked(invoke).mockResolvedValue({
      success: false,
      stdout: '',
      stderr: 'auth failed',
      code: 1,
    })

    await expect(sendToClaudeCode('hello')).rejects.toThrow('auth failed')
  })
})
