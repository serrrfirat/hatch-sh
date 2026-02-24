import { describe, expect, it } from 'vitest'
import { hasUsableWorkspacePath } from '../useChat'

describe('hasUsableWorkspacePath', () => {
  it('returns true for a non-empty path', () => {
    expect(hasUsableWorkspacePath('/tmp/worktree')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(hasUsableWorkspacePath('')).toBe(false)
  })

  it('returns false for whitespace-only path', () => {
    expect(hasUsableWorkspacePath('   ')).toBe(false)
  })

  it('returns false for null', () => {
    expect(hasUsableWorkspacePath(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(hasUsableWorkspacePath(undefined)).toBe(false)
  })
})
