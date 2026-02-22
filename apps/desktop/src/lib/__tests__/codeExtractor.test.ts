import { describe, expect, it } from 'vitest'
import { extractCodeBlocks } from '../codeExtractor'

describe('extractCodeBlocks (desktop)', () => {
  it('parses fenced code blocks with colon file path syntax', () => {
    const response = '```tsx:src/App.tsx\nexport default function App() {}\n```'
    const blocks = extractCodeBlocks(response)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.filePath).toBe('src/App.tsx')
    expect(blocks[0]?.language).toBe('tsx')
  })

  it('parses fenced code blocks with space file path syntax', () => {
    const response =
      '```ts src/utils/math.ts\nexport const add = (a: number, b: number) => a + b\n```'
    const blocks = extractCodeBlocks(response)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.filePath).toBe('src/utils/math.ts')
    expect(blocks[0]?.language).toBe('ts')
  })

  it('parses // File: path from code content', () => {
    const response =
      '```tsx\n// File: src/components/Button.tsx\nexport function Button() { return null }\n```'
    const blocks = extractCodeBlocks(response)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.filePath).toBe('src/components/Button.tsx')
    expect(blocks[0]?.content.startsWith('// File:')).toBe(false)
  })
})
