import { describe, expect, it, vi } from 'vitest'
import {
  appendStreamInterruptedNotice,
  createLineBuffer,
  hasStreamInterruptedNotice,
  retryWithExponentialBackoff,
  safeParseJsonLine,
} from '../streamUtils'

describe('streamUtils - line buffering', () => {
  it('reassembles lines split across chunk boundaries', () => {
    const buffer = createLineBuffer()

    expect(buffer.pushChunk('{"type":"text"')).toEqual([])
    expect(buffer.pushChunk(',"content":"hello"}\n')).toEqual(['{"type":"text","content":"hello"}'])
  })

  it('supports multiple lines and keeps trailing partial line buffered', () => {
    const buffer = createLineBuffer()

    expect(buffer.pushChunk('one\ntwo\nthree')).toEqual(['one', 'two'])
    expect(buffer.pushChunk('-continued\n')).toEqual(['three-continued'])
  })
})

describe('streamUtils - JSON validation', () => {
  it('parses valid JSON objects', () => {
    const result = safeParseJsonLine('{"type":"text","content":"ok"}', 'claude-code')

    expect(result.value).toEqual({ type: 'text', content: 'ok' })
    expect(result.errorEvent).toBeUndefined()
  })

  it('unwraps double-encoded JSON payloads', () => {
    const result = safeParseJsonLine(
      '"{\\"type\\":\\"text\\",\\"content\\":\\"wrapped\\"}"',
      'opencode'
    )

    expect(result.value).toEqual({ type: 'text', content: 'wrapped' })
    expect(result.errorEvent).toBeUndefined()
  })

  it('emits structured error event for malformed truncated JSON and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = safeParseJsonLine('{"type":"text"', 'cursor')

    expect(result.value).toBeNull()
    expect(result.errorEvent).toEqual({
      type: 'error',
      content: 'cursor stream emitted malformed JSON',
    })
    expect(warnSpy).toHaveBeenCalledWith('[cursor] Malformed JSON line:', '{"type":"text"')

    warnSpy.mockRestore()
  })

  it('returns null with no error event for empty lines', () => {
    const result = safeParseJsonLine('   ', 'cursor')

    expect(result.value).toBeNull()
    expect(result.errorEvent).toBeUndefined()
  })
})

describe('streamUtils - retry and interruption helpers', () => {
  it('retries with exponential backoff and succeeds before max retries', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('network-1'))
      .mockRejectedValueOnce(new Error('network-2'))
      .mockResolvedValue('ok')

    const result = await retryWithExponentialBackoff(operation, {
      maxRetries: 3,
      baseDelayMs: 1000,
      sleep,
    })

    expect(result).toBe('ok')
    expect(operation).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenNthCalledWith(1, 1000)
    expect(sleep).toHaveBeenNthCalledWith(2, 2000)
  })

  it('throws after max retries', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('always-fails'))

    await expect(
      retryWithExponentialBackoff(operation, {
        maxRetries: 3,
        baseDelayMs: 1000,
        sleep,
      })
    ).rejects.toThrow('always-fails')

    expect(operation).toHaveBeenCalledTimes(4)
    expect(sleep).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenNthCalledWith(3, 4000)
  })

  it('preserves partial text and appends interruption hint once', () => {
    expect(appendStreamInterruptedNotice('partial response')).toBe(
      'partial response\n\n[Stream interrupted — click Retry]'
    )
    expect(
      appendStreamInterruptedNotice('partial response\n\n[Stream interrupted — click Retry]')
    ).toBe('partial response\n\n[Stream interrupted — click Retry]')
  })

  it('detects interruption hint suffix reliably', () => {
    expect(hasStreamInterruptedNotice('partial\n\n[Stream interrupted — click Retry]')).toBe(true)
    expect(hasStreamInterruptedNotice('partial response')).toBe(false)
  })
})
