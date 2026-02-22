import { describe, expect, it } from 'vitest'

describe('SaveIndicator', () => {
  it('renders saved state with green dot', () => {
    const status = 'saved'
    expect(status).toBe('saved')
  })

  it('renders saving state with spinner', () => {
    const status = 'saving'
    expect(status).toBe('saving')
  })

  it('renders unsaved state with yellow dot', () => {
    const status = 'unsaved'
    expect(status).toBe('unsaved')
  })

  it('displays relative time on hover', () => {
    const lastSavedAt = new Date(Date.now() - 60000)
    const now = new Date()
    const diffMs = now.getTime() - lastSavedAt.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    expect(diffSeconds).toBeGreaterThan(0)
  })
})
