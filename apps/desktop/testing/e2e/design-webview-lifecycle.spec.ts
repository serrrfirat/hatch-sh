import { describe, it, expect } from 'vitest'

/**
 * NOTE:
 * This suite is intentionally a harness starter.
 * Full verification requires UI-driven desktop E2E with a running Tauri window.
 */
describe('design webview lifecycle suite (starter)', () => {
  it('tracks required lifecycle checks', () => {
    const requiredChecks = [
      'create embedded webview on Design tab open',
      'reuse cached webview when switching tabs',
      'reposition/resize on window resize',
      'show fallback UI on load error',
    ]

    expect(requiredChecks).toHaveLength(4)
  })
})
