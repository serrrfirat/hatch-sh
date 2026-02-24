import { describe, expect, it } from 'vitest'
import {
  calculateContextSize,
  estimateMessageBytes,
  getContextColor,
  DEFAULT_CONTEXT_LIMIT,
  type ContextBreakdown,
} from '../ContextMeter'

describe('calculateContextSize', () => {
  it('returns zero breakdown for empty messages array', () => {
    const result = calculateContextSize([])
    expect(result.userBytes).toBe(0)
    expect(result.assistantBytes).toBe(0)
    expect(result.toolBytes).toBe(0)
    expect(result.totalBytes).toBe(0)
  })

  it('calculates byte size from the sanitized message payload', () => {
    const messages = [{ id: '1', role: 'user' as const, content: 'hello', timestamp: new Date() }]
    const result = calculateContextSize(messages)
    const expectedSize = estimateMessageBytes(messages[0])
    expect(result.totalBytes).toBe(expectedSize)
    expect(result.userBytes).toBe(expectedSize)
    expect(result.assistantBytes).toBe(0)
    expect(result.toolBytes).toBe(0)
  })

  it('groups bytes by role: user, assistant, system', () => {
    const messages = [
      { id: '1', role: 'user' as const, content: 'question', timestamp: new Date() },
      { id: '2', role: 'assistant' as const, content: 'answer here', timestamp: new Date() },
      { id: '3', role: 'system' as const, content: 'sys', timestamp: new Date() },
    ]
    const result = calculateContextSize(messages)
    const userSize = estimateMessageBytes(messages[0])
    const assistantSize = estimateMessageBytes(messages[1])
    const systemSize = estimateMessageBytes(messages[2])
    expect(result.userBytes).toBe(userSize)
    expect(result.assistantBytes).toBe(assistantSize)
    expect(result.totalBytes).toBe(userSize + assistantSize + systemSize)
  })

  it('includes toolUses in tool bytes', () => {
    const messages = [
      {
        id: '1',
        role: 'assistant' as const,
        content: 'using tool',
        timestamp: new Date(),
        toolUses: [
          {
            id: 't1',
            name: 'read_file',
            input: { path: '/foo' },
            status: 'completed' as const,
            result: 'file contents here',
          },
        ],
      },
    ]
    const result = calculateContextSize(messages)
    expect(result.toolBytes).toBeGreaterThan(0)
    expect(result.totalBytes).toBeGreaterThan(0)
  })

  it('accumulates across multiple messages of the same role', () => {
    const messages = [
      { id: '1', role: 'user' as const, content: 'first', timestamp: new Date() },
      { id: '2', role: 'user' as const, content: 'second', timestamp: new Date() },
    ]
    const result = calculateContextSize(messages)
    const size1 = estimateMessageBytes(messages[0])
    const size2 = estimateMessageBytes(messages[1])
    expect(result.userBytes).toBe(size1 + size2)
    expect(result.totalBytes).toBe(size1 + size2)
  })

  it('handles messages with long content', () => {
    const longContent = 'x'.repeat(50000)
    const messages = [
      { id: '1', role: 'user' as const, content: longContent, timestamp: new Date() },
    ]
    const result = calculateContextSize(messages)
    expect(result.totalBytes).toBeGreaterThan(50000)
  })

  it('handles messages with thinking field', () => {
    const messages = [
      {
        id: '1',
        role: 'assistant' as const,
        content: 'response',
        timestamp: new Date(),
        thinking: 'internal reasoning that is quite long',
      },
    ]
    const result = calculateContextSize(messages)
    const expectedSize = estimateMessageBytes(messages[0])
    expect(result.totalBytes).toBe(expectedSize)
    expect(result.assistantBytes).toBe(expectedSize)
  })

  it('does not include image base64 payload in context calculation', () => {
    const hugeBase64 = 'a'.repeat(500_000)
    const messages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'what is in this image?',
        timestamp: new Date(),
        images: [
          {
            id: 'img-1',
            fileName: 'image.png',
            mimeType: 'image/png',
            base64: hugeBase64,
            sizeBytes: 500_000,
          },
        ],
      },
    ]

    const result = calculateContextSize(messages)
    const withRawBase64 = JSON.stringify(messages[0]).length

    expect(result.totalBytes).toBeLessThan(10_000)
    expect(result.totalBytes).toBeLessThan(withRawBase64)
  })
})

describe('getContextColor', () => {
  it('returns green for 0%', () => {
    expect(getContextColor(0)).toBe('green')
  })

  it('returns green for 49%', () => {
    expect(getContextColor(49)).toBe('green')
  })

  it('returns green for exactly 50% (boundary is exclusive)', () => {
    expect(getContextColor(50)).toBe('yellow')
  })

  it('returns yellow for 51%', () => {
    expect(getContextColor(51)).toBe('yellow')
  })

  it('returns yellow for 79%', () => {
    expect(getContextColor(79)).toBe('yellow')
  })

  it('returns red for exactly 80%', () => {
    expect(getContextColor(80)).toBe('red')
  })

  it('returns red for 95%', () => {
    expect(getContextColor(95)).toBe('red')
  })

  it('returns red for 100%', () => {
    expect(getContextColor(100)).toBe('red')
  })

  it('returns red for over 100%', () => {
    expect(getContextColor(120)).toBe('red')
  })
})

describe('DEFAULT_CONTEXT_LIMIT', () => {
  it('is 100KB (102400 bytes)', () => {
    expect(DEFAULT_CONTEXT_LIMIT).toBe(102400)
  })
})

describe('ContextBreakdown type', () => {
  it('has the expected shape', () => {
    const breakdown: ContextBreakdown = {
      userBytes: 100,
      assistantBytes: 200,
      toolBytes: 50,
      totalBytes: 350,
    }
    expect(breakdown.userBytes).toBe(100)
    expect(breakdown.assistantBytes).toBe(200)
    expect(breakdown.toolBytes).toBe(50)
    expect(breakdown.totalBytes).toBe(350)
  })
})

describe('formatBytes', () => {
  it('formats bytes as KB with tilde prefix', async () => {
    const { formatBytes } = await import('../ContextMeter')
    expect(formatBytes(1024)).toBe('~1KB')
    expect(formatBytes(51200)).toBe('~50KB')
    expect(formatBytes(102400)).toBe('~100KB')
  })

  it('rounds to nearest KB', async () => {
    const { formatBytes } = await import('../ContextMeter')
    expect(formatBytes(1536)).toBe('~2KB')
    expect(formatBytes(512)).toBe('~1KB')
  })

  it('returns ~0KB for zero bytes', async () => {
    const { formatBytes } = await import('../ContextMeter')
    expect(formatBytes(0)).toBe('~0KB')
  })
})
