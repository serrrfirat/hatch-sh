import { describe, it, expect } from 'vitest'
import { isAuthExpiredError } from '../bridge'

describe('isAuthExpiredError', () => {
  // --- Expiration Detection Tests ---

  it('detects 401 status code in error message', () => {
    expect(isAuthExpiredError(new Error('HTTP 401: Bad credentials'))).toBe(true)
  })

  it('detects "Bad credentials" error', () => {
    expect(isAuthExpiredError(new Error('Bad credentials'))).toBe(true)
  })

  it('detects "token expired" error', () => {
    expect(isAuthExpiredError(new Error('Your token has expired'))).toBe(true)
  })

  it('detects "authentication failed" from git push', () => {
    expect(
      isAuthExpiredError(
        new Error("fatal: Authentication failed for 'https://github.com/owner/repo.git/'")
      )
    ).toBe(true)
  })

  it('detects "not authenticated" from gh CLI', () => {
    expect(isAuthExpiredError('Not authenticated')).toBe(true)
  })

  it('detects case-insensitive matching', () => {
    expect(isAuthExpiredError('AUTHENTICATION FAILED')).toBe(true)
    expect(isAuthExpiredError('bad CREDENTIALS')).toBe(true)
  })

  it('returns false for non-auth errors', () => {
    expect(isAuthExpiredError(new Error('Network error'))).toBe(false)
    expect(isAuthExpiredError(new Error('Repository not found'))).toBe(false)
    expect(isAuthExpiredError(new Error('Merge conflict'))).toBe(false)
  })

  it('returns false for empty/null inputs', () => {
    expect(isAuthExpiredError('')).toBe(false)
    expect(isAuthExpiredError(null)).toBe(false)
    expect(isAuthExpiredError(undefined)).toBe(false)
  })

  it('handles non-string/non-Error inputs', () => {
    expect(isAuthExpiredError(42)).toBe(false)
    expect(isAuthExpiredError({ message: '401' })).toBe(false)
  })
})
