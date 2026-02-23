import { describe, it, expect } from 'vitest'
import { mapGitError } from '../errorMapper'

describe('mapGitError', () => {
  it('maps non-fast-forward push rejection to user-friendly message', () => {
    const stderr =
      "error: failed to push some refs to 'origin'\nhint: Updates were rejected because the tip of your current branch is behind\nhint: its remote counterpart."
    const result = mapGitError(stderr)

    expect(result.message).toContain('pull the latest changes first')
    expect(result.action).toBe('pull-and-retry')
  })

  it('maps authentication failure (401) to reconnect message', () => {
    const stderr = "fatal: Authentication failed for 'https://github.com/owner/repo.git/'"
    const result = mapGitError(stderr)

    expect(result.message).toContain('GitHub authentication failed')
    expect(result.message).toContain('reconnect')
    expect(result.action).toBe('open-settings')
  })

  it('maps merge conflict to specific files message', () => {
    const stderr =
      'CONFLICT (content): Merge conflict in src/App.tsx\nCONFLICT (content): Merge conflict in package.json\nAutomatic merge failed'
    const result = mapGitError(stderr)

    expect(result.message).toContain('Merge conflict')
    expect(result.message).toContain('src/App.tsx')
    expect(result.message).toContain('package.json')
    expect(result.action).toBe('resolve-conflicts')
  })

  it('maps clone failure (404) to repository not found message', () => {
    const stderr = "fatal: repository 'https://github.com/owner/nonexistent.git/' not found"
    const result = mapGitError(stderr)

    expect(result.message).toContain('Repository not found')
    expect(result.message).toContain('check the URL')
    expect(result.action).toBe('check-url')
  })

  it('maps network error to connectivity message', () => {
    const stderr =
      "fatal: unable to access 'https://github.com/owner/repo.git/': Could not resolve host: github.com"
    const result = mapGitError(stderr)

    expect(result.message).toContain('Network error')
    expect(result.message).toContain('internet connection')
    expect(result.action).toBe('retry')
  })

  it('maps permission denied to access message', () => {
    const stderr =
      "fatal: could not read Username for 'https://github.com': terminal prompts disabled"
    const result = mapGitError(stderr)

    expect(result.message).toContain('Permission denied')
    expect(result.message).toContain('write access')
    expect(result.action).toBe('check-permissions')
  })

  it('returns generic message for unknown errors', () => {
    const stderr = 'some random error that we do not recognize'
    const result = mapGitError(stderr)

    expect(result.message).toBeTruthy()
    expect(result.message.length > 0).toBe(true)
  })

  it('handles empty stderr gracefully', () => {
    const result = mapGitError('')

    expect(result.message).toBeTruthy()
    expect(result.message.length > 0).toBe(true)
  })

  it('returns object with message and optional action fields', () => {
    const result = mapGitError('fatal: some error')

    expect(result).toHaveProperty('message')
    expect(typeof result.message).toBe('string')
    expect(result.action === undefined || typeof result.action === 'string').toBe(true)
  })

  it('handles case-insensitive error matching', () => {
    const stderr = "FATAL: AUTHENTICATION FAILED FOR 'HTTPS://GITHUB.COM/OWNER/REPO.GIT/'"
    const result = mapGitError(stderr)

    expect(result.message).toContain('authentication')
  })
})
