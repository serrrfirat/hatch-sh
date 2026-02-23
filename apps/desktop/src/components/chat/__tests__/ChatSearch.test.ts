import { describe, expect, it } from 'vitest'

interface SearchMatch {
  messageId: string
  messageIndex: number
}

function findMatches(
  query: string,
  messages: Array<{ id: string; content: string }>
): SearchMatch[] {
  if (!query.trim()) return []
  const lowerQuery = query.toLowerCase()
  const matches: SearchMatch[] = []
  messages.forEach((message, index) => {
    if (message.content.toLowerCase().includes(lowerQuery)) {
      matches.push({ messageId: message.id, messageIndex: index })
    }
  })
  return matches
}

describe('ChatSearch - search logic', () => {
  it('returns empty array when query is empty', () => {
    const messages = [
      { id: '1', content: 'Hello world' },
      { id: '2', content: 'Goodbye world' },
    ]
    const matches = findMatches('', messages)
    expect(matches).toEqual([])
  })

  it('returns empty array when query is whitespace only', () => {
    const messages = [
      { id: '1', content: 'Hello world' },
      { id: '2', content: 'Goodbye world' },
    ]
    const matches = findMatches('   ', messages)
    expect(matches).toEqual([])
  })

  it('finds matches case-insensitively', () => {
    const messages = [
      { id: '1', content: 'Hello World' },
      { id: '2', content: 'goodbye world' },
      { id: '3', content: 'WORLD' },
    ]
    const matches = findMatches('world', messages)
    expect(matches).toHaveLength(3)
    expect(matches[0].messageIndex).toBe(0)
    expect(matches[1].messageIndex).toBe(1)
    expect(matches[2].messageIndex).toBe(2)
  })

  it('finds partial word matches', () => {
    const messages = [
      { id: '1', content: 'testing' },
      { id: '2', content: 'test case' },
      { id: '3', content: 'no match' },
    ]
    const matches = findMatches('test', messages)
    expect(matches).toHaveLength(2)
    expect(matches[0].messageId).toBe('1')
    expect(matches[1].messageId).toBe('2')
  })

  it('returns correct message indices', () => {
    const messages = [
      { id: 'a', content: 'first' },
      { id: 'b', content: 'second' },
      { id: 'c', content: 'third with first' },
      { id: 'd', content: 'fourth' },
    ]
    const matches = findMatches('first', messages)
    expect(matches).toHaveLength(2)
    expect(matches[0]).toEqual({ messageId: 'a', messageIndex: 0 })
    expect(matches[1]).toEqual({ messageId: 'c', messageIndex: 2 })
  })

  it('handles special characters in query', () => {
    const messages = [
      { id: '1', content: 'error: something went wrong' },
      { id: '2', content: 'no error here' },
    ]
    const matches = findMatches('error:', messages)
    expect(matches).toHaveLength(1)
    expect(matches[0].messageId).toBe('1')
  })

  it('handles empty message list', () => {
    const matches = findMatches('query', [])
    expect(matches).toEqual([])
  })

  it('handles messages with empty content', () => {
    const messages = [
      { id: '1', content: '' },
      { id: '2', content: 'hello' },
      { id: '3', content: '' },
    ]
    const matches = findMatches('hello', messages)
    expect(matches).toHaveLength(1)
    expect(matches[0].messageId).toBe('2')
  })
})

describe('ChatSearch - navigation logic', () => {
  it('cycles forward through matches', () => {
    const matches = [
      { messageId: 'a', messageIndex: 0 },
      { messageId: 'b', messageIndex: 1 },
      { messageId: 'c', messageIndex: 2 },
    ]

    let currentIndex = 0
    currentIndex = (currentIndex + 1) % matches.length
    expect(currentIndex).toBe(1)

    currentIndex = (currentIndex + 1) % matches.length
    expect(currentIndex).toBe(2)

    currentIndex = (currentIndex + 1) % matches.length
    expect(currentIndex).toBe(0)
  })

  it('cycles backward through matches', () => {
    const matches = [
      { messageId: 'a', messageIndex: 0 },
      { messageId: 'b', messageIndex: 1 },
      { messageId: 'c', messageIndex: 2 },
    ]

    let currentIndex = 0
    currentIndex = (currentIndex - 1 + matches.length) % matches.length
    expect(currentIndex).toBe(2)

    currentIndex = (currentIndex - 1 + matches.length) % matches.length
    expect(currentIndex).toBe(1)

    currentIndex = (currentIndex - 1 + matches.length) % matches.length
    expect(currentIndex).toBe(0)
  })

  it('handles single match navigation', () => {
    const matches = [{ messageId: 'a', messageIndex: 0 }]

    let currentIndex = 0
    currentIndex = (currentIndex + 1) % matches.length
    expect(currentIndex).toBe(0)

    currentIndex = (currentIndex - 1 + matches.length) % matches.length
    expect(currentIndex).toBe(0)
  })
})

describe('ChatSearch - match count display', () => {
  it('displays correct match count', () => {
    const messages = [
      { id: '1', content: 'hello' },
      { id: '2', content: 'hello world' },
      { id: '3', content: 'goodbye' },
    ]
    const matches = findMatches('hello', messages)
    expect(matches.length).toBe(2)
  })

  it('displays 0 matches for no results', () => {
    const messages = [
      { id: '1', content: 'hello' },
      { id: '2', content: 'world' },
    ]
    const matches = findMatches('xyz', messages)
    expect(matches.length).toBe(0)
  })

  it('displays correct current match index (1-indexed for display)', () => {
    const matchArray = [
      { messageId: 'a', messageIndex: 0 },
      { messageId: 'b', messageIndex: 1 },
      { messageId: 'c', messageIndex: 2 },
    ]
    let currentIndex = 0
    let displayIndex = currentIndex + 1
    expect(displayIndex).toBe(1)

    currentIndex = 1
    displayIndex = currentIndex + 1
    expect(displayIndex).toBe(2)
    expect(matchArray.length).toBeGreaterThan(0)
  })
})
