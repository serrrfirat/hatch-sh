import { describe, it, expect } from 'vitest'
import { extractCodeBlocks, type CodeBlock } from '../codeExtractor'

describe('extractCodeBlocks', () => {
  it('extracts single code block', () => {
    const input = "Here's code:\n```tsx\nconst x = 1\n```"
    const result = extractCodeBlocks(input)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('const x = 1')
    expect(result[0].language).toBe('tsx')
  })

  it('extracts multiple code blocks', () => {
    const input = "First:\n```tsx\nconst App = () => <div/>\n```\nSecond:\n```tsx\nconst Header = () => <h1/>\n```\nThird:\n```ts\nexport const utils = {}\n```"
    const result = extractCodeBlocks(input)
    expect(result).toHaveLength(3)
  })

  it('parses file path from fence header (```tsx src/App.tsx)', () => {
    const input = "```tsx src/App.tsx\nexport default function App() {}\n```"
    const result = extractCodeBlocks(input)
    expect(result[0].filePath).toBe('src/App.tsx')
  })

  it('parses file path from colon syntax (```tsx:src/App.tsx)', () => {
    const input = "```tsx:src/App.tsx\nexport default function App() {}\n```"
    const result = extractCodeBlocks(input)
    expect(result[0].filePath).toBe('src/App.tsx')
  })

  it('parses file path from // File: comment', () => {
    const input = "```tsx\n// File: src/App.tsx\nexport default function App() {}\n```"
    const result = extractCodeBlocks(input)
    expect(result[0].filePath).toBe('src/App.tsx')
  })

  it('defaults first block to App.tsx when no path hint', () => {
    const input = "```tsx\nconst x = 1\n```"
    const result = extractCodeBlocks(input)
    expect(result[0].filePath).toBe('App.tsx')
  })

  it('handles response with no code blocks', () => {
    const input = "Just some text, no code"
    const result = extractCodeBlocks(input)
    expect(result).toEqual([])
  })

  it('handles empty code blocks', () => {
    const input = "```tsx\n```"
    const result = extractCodeBlocks(input)
    expect(result).toEqual([])
  })

  it('extracts language from fence', () => {
    const input = "```tsx\nconst a = 1\n```\n```css\n.foo {}\n```\n```json\n{}\n```"
    const result = extractCodeBlocks(input)
    expect(result[0].language).toBe('tsx')
    expect(result[1].language).toBe('css')
    expect(result[2].language).toBe('json')
  })
})
