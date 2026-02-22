import { describe, it, expect } from 'vitest'
import {
  getFileExtension,
  getFileIconType,
  buildExpandedPathSet,
  sortTreeNodes,
  type FileTreeNode,
} from '../fileTreeUtils'

describe('getFileExtension', () => {
  it('returns extension for standard files', () => {
    expect(getFileExtension('index.tsx')).toBe('tsx')
    expect(getFileExtension('style.css')).toBe('css')
    expect(getFileExtension('Cargo.toml')).toBe('toml')
  })

  it('returns empty string for files without extension', () => {
    expect(getFileExtension('Makefile')).toBe('')
    expect(getFileExtension('Dockerfile')).toBe('')
  })

  it('returns last extension for dotfiles with extensions', () => {
    expect(getFileExtension('.env.local')).toBe('local')
    expect(getFileExtension('config.d.ts')).toBe('ts')
  })
})

describe('getFileIconType', () => {
  it('returns "code" for source code files', () => {
    expect(getFileIconType('app.tsx')).toBe('code')
    expect(getFileIconType('lib.rs')).toBe('code')
    expect(getFileIconType('main.py')).toBe('code')
    expect(getFileIconType('index.js')).toBe('code')
  })

  it('returns "text" for non-code files', () => {
    expect(getFileIconType('readme.md')).toBe('text')
    expect(getFileIconType('data.json')).toBe('text')
    expect(getFileIconType('style.css')).toBe('text')
  })

  it('returns "text" for files without extension', () => {
    expect(getFileIconType('Makefile')).toBe('text')
  })
})

describe('buildExpandedPathSet', () => {
  it('returns empty set for empty file path', () => {
    const result = buildExpandedPathSet('')
    expect(result.size).toBe(0)
  })

  it('returns parent directories for a nested file path', () => {
    const result = buildExpandedPathSet('src/components/Button.tsx')
    expect(result.has('src')).toBe(true)
    expect(result.has('src/components')).toBe(true)
    expect(result.has('src/components/Button.tsx')).toBe(false)
  })

  it('handles single-level paths', () => {
    const result = buildExpandedPathSet('index.ts')
    expect(result.size).toBe(0)
  })
})

describe('sortTreeNodes', () => {
  const makeNode = (name: string, isDir: boolean): FileTreeNode => ({
    name,
    path: name,
    is_directory: isDir,
  })

  it('puts directories before files', () => {
    const nodes: FileTreeNode[] = [
      makeNode('file.ts', false),
      makeNode('src', true),
      makeNode('another.ts', false),
      makeNode('lib', true),
    ]
    const sorted = sortTreeNodes(nodes)
    expect(sorted[0].name).toBe('lib')
    expect(sorted[1].name).toBe('src')
    expect(sorted[2].name).toBe('another.ts')
    expect(sorted[3].name).toBe('file.ts')
  })

  it('sorts alphabetically within directories and files', () => {
    const nodes: FileTreeNode[] = [
      makeNode('zebra', true),
      makeNode('alpha', true),
      makeNode('zoo.ts', false),
      makeNode('app.ts', false),
    ]
    const sorted = sortTreeNodes(nodes)
    expect(sorted.map(n => n.name)).toEqual(['alpha', 'zebra', 'app.ts', 'zoo.ts'])
  })

  it('sorts case-insensitively', () => {
    const nodes: FileTreeNode[] = [
      makeNode('Zebra', true),
      makeNode('alpha', true),
    ]
    const sorted = sortTreeNodes(nodes)
    expect(sorted[0].name).toBe('alpha')
    expect(sorted[1].name).toBe('Zebra')
  })

  it('returns empty array for empty input', () => {
    expect(sortTreeNodes([])).toEqual([])
  })
})