import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTauriCoreMock, createTauriEventMock } from '../helpers'

vi.mock('@tauri-apps/api/core', () => createTauriCoreMock())
vi.mock('@tauri-apps/api/event', () => createTauriEventMock())

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

  it('handles interleaved event types correctly', async () => {
    const stdout = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Step 1 ' },
            { type: 'tool_use', id: 'tool-a', name: 'write', input: { path: 'a.ts', content: 'code' } },
          ],
        },
      }),
      JSON.stringify({
        type: 'tool_result',
        tool_use_id: 'tool-a',
        content: 'written',
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Step 2' },
          ],
        },
      }),
    ].join('\n')

    vi.mocked(invoke).mockResolvedValue({
      success: true,
      stdout,
      stderr: '',
      code: 0,
    })

    const events: string[] = []
    const result = await sendToClaudeCode('do something', 'system', (e) => {
      events.push(e.type)
    })

    expect(result).toContain('Step 1')
    expect(result).toContain('Step 2')
    expect(events).toContain('tool_use')
    expect(events).toContain('tool_result')
  })

  it('handles malformed JSON lines gracefully', async () => {
    const stdout = [
      'not valid json',
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'recovered' }] },
      }),
    ].join('\n')

    vi.mocked(invoke).mockResolvedValue({
      success: true,
      stdout,
      stderr: '',
      code: 0,
    })

    const result = await sendToClaudeCode('test')
    expect(result).toContain('recovered')
  })
})
