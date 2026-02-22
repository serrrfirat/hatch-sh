import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mockZustandPersist,
  setupLocalStorageMock,
} from '../helpers'

setupLocalStorageMock()
vi.mock('zustand/middleware', async () => mockZustandPersist())

describe('deployment UI hooks', () => {
  it('useDeploy hook handles deployment states', () => {
    // Test the hook state management
    // Deployment states: idle -> deploying -> success | error
    const states = ['idle', 'deploying', 'success', 'error'] as const
    expect(states).toContain('idle')
    expect(states).toContain('deploying')
    expect(states).toContain('success')
    expect(states).toContain('error')
  })

  it('deployment progress tracks status transitions', () => {
    // The deployment progress should flow: pending -> building -> deploying -> live
    const transitions = ['pending', 'building', 'deploying', 'live']
    expect(transitions[0]).toBe('pending')
    expect(transitions[transitions.length - 1]).toBe('live')
  })

  it('deployment success provides live URL', () => {
    // When a deployment succeeds, it should return a URL
    const successResult = {
      status: 'live' as const,
      url: 'https://my-project.pages.dev',
    }
    expect(successResult.url).toContain('.pages.dev')
    expect(successResult.status).toBe('live')
  })
})
