import { describe, expect, it } from 'vitest'
import { windowMessages, getDroppedMessages } from '../chatWindow'
import type { Message } from '../../stores/chatStore'

describe('chatWindow - sliding window for chat history', () => {
  const createMessage = (role: 'user' | 'assistant', content: string, index: number): Message => ({
    id: `msg-${index}`,
    role,
    content,
    timestamp: new Date(Date.now() + index * 1000),
  })

  it('returns all messages unchanged when total messages <= windowSize', () => {
    const messages: Message[] = [
      createMessage('user', 'Hello', 0),
      createMessage('assistant', 'Hi there', 1),
      createMessage('user', 'How are you?', 2),
    ]

    const result = windowMessages(messages, 10)

    expect(result).toEqual(messages)
    expect(result.length).toBe(3)
  })

  it('preserves system message at the start and takes last N messages', () => {
    const messages: Message[] = [
      { ...createMessage('user', 'System context', 0), role: 'system' },
      createMessage('user', 'Message 1', 1),
      createMessage('assistant', 'Response 1', 2),
      createMessage('user', 'Message 2', 3),
      createMessage('assistant', 'Response 2', 4),
      createMessage('user', 'Message 3', 5),
      createMessage('assistant', 'Response 3', 6),
    ]

    const result = windowMessages(messages, 3)

    expect(result.length).toBe(4)
    expect(result[0].role).toBe('system')
    expect(result[0].content).toBe('System context')
    expect(result[1].content).toBe('Response 2')
    expect(result[2].content).toBe('Message 3')
    expect(result[3].content).toBe('Response 3')
  })

  it('takes last N messages when no system message exists', () => {
    const messages: Message[] = [
      createMessage('user', 'Message 1', 0),
      createMessage('assistant', 'Response 1', 1),
      createMessage('user', 'Message 2', 2),
      createMessage('assistant', 'Response 2', 3),
      createMessage('user', 'Message 3', 4),
    ]

    const result = windowMessages(messages, 2)

    expect(result.length).toBe(2)
    expect(result[0].content).toBe('Response 2')
    expect(result[1].content).toBe('Message 3')
  })

  it('handles empty message array', () => {
    const result = windowMessages([], 10)

    expect(result).toEqual([])
  })

  it('handles single system message', () => {
    const messages: Message[] = [{ ...createMessage('user', 'System context', 0), role: 'system' }]

    const result = windowMessages(messages, 5)

    expect(result).toEqual(messages)
  })

  it('handles windowSize of 0', () => {
    const messages: Message[] = [
      { ...createMessage('user', 'System context', 0), role: 'system' },
      createMessage('user', 'Message 1', 1),
      createMessage('assistant', 'Response 1', 2),
    ]

    const result = windowMessages(messages, 0)

    expect(result.length).toBe(1)
    expect(result[0].role).toBe('system')
  })

  it('handles windowSize of 1 with system message', () => {
    const messages: Message[] = [
      { ...createMessage('user', 'System context', 0), role: 'system' },
      createMessage('user', 'Message 1', 1),
      createMessage('assistant', 'Response 1', 2),
      createMessage('user', 'Message 2', 3),
    ]

    const result = windowMessages(messages, 1)

    expect(result.length).toBe(2)
    expect(result[0].role).toBe('system')
    expect(result[1].content).toBe('Message 2')
  })

  it('preserves message properties (thinking, toolUses, duration)', () => {
    const messages: Message[] = [
      {
        ...createMessage('user', 'System context', 0),
        role: 'system',
      },
      {
        ...createMessage('assistant', 'Response with thinking', 1),
        thinking: 'Let me think about this',
        duration: 2.5,
      },
      createMessage('user', 'Follow up', 2),
    ]

    const result = windowMessages(messages, 2)

    expect(result.length).toBe(3)
    expect(result[1].thinking).toBe('Let me think about this')
    expect(result[1].duration).toBe(2.5)
  })

  it('does not modify original messages array', () => {
    const messages: Message[] = [
      { ...createMessage('user', 'System context', 0), role: 'system' },
      createMessage('user', 'Message 1', 1),
      createMessage('assistant', 'Response 1', 2),
    ]

    const originalLength = messages.length
    windowMessages(messages, 1)

    expect(messages.length).toBe(originalLength)
  })
})

describe('getDroppedMessages - identify messages dropped by windowing', () => {
  const createMessage = (role: 'user' | 'assistant', content: string, index: number): Message => ({
    id: `msg-${index}`,
    role,
    content,
    timestamp: new Date(Date.now() + index * 1000),
  })

  it('returns empty array when no messages are dropped', () => {
    const messages: Message[] = [
      createMessage('user', 'Hello', 0),
      createMessage('assistant', 'Hi', 1),
    ]

    const dropped = getDroppedMessages(messages, 10)

    expect(dropped).toEqual([])
  })

  it('returns dropped messages when windowing truncates (with system message)', () => {
    const messages: Message[] = [
      { ...createMessage('user', 'System', 0), role: 'system' } as Message,
      createMessage('user', 'Message 1', 1),
      createMessage('assistant', 'Response 1', 2),
      createMessage('user', 'Message 2', 3),
      createMessage('assistant', 'Response 2', 4),
    ]

    const dropped = getDroppedMessages(messages, 2)

    expect(dropped.length).toBe(2)
    expect(dropped[0].content).toBe('Message 1')
    expect(dropped[1].content).toBe('Response 1')
  })

  it('returns dropped messages when no system message exists', () => {
    const messages: Message[] = [
      createMessage('user', 'Message 1', 0),
      createMessage('assistant', 'Response 1', 1),
      createMessage('user', 'Message 2', 2),
      createMessage('assistant', 'Response 2', 3),
    ]

    const dropped = getDroppedMessages(messages, 2)

    expect(dropped.length).toBe(2)
    expect(dropped[0].content).toBe('Message 1')
    expect(dropped[1].content).toBe('Response 1')
  })

  it('returns empty array for empty messages', () => {
    expect(getDroppedMessages([], 5)).toEqual([])
  })

  it('does not include the system message in dropped messages', () => {
    const messages: Message[] = [
      { ...createMessage('user', 'System', 0), role: 'system' } as Message,
      createMessage('user', 'Message 1', 1),
      createMessage('assistant', 'Response 1', 2),
      createMessage('user', 'Message 2', 3),
    ]

    const dropped = getDroppedMessages(messages, 1)

    expect(dropped.every((m) => m.role !== 'system')).toBe(true)
    expect(dropped.length).toBe(2)
    expect(dropped[0].content).toBe('Message 1')
    expect(dropped[1].content).toBe('Response 1')
  })
})
