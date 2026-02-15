import { describe, it, expect } from 'vitest'

describe('failure path matrix (starter)', () => {
  it('declares priority fault scenarios to implement', () => {
    const scenarios = [
      'agent stream interrupted mid-response',
      'malformed JSON in idea-maze interview output',
      'git push failed / missing upstream',
      'github auth expired during PR creation',
      'webview creation failed in design mode',
    ]

    expect(scenarios).toContain('git push failed / missing upstream')
  })
})
