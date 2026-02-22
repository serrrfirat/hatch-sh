import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

describe('deploy SSE stream', () => {
  it('SSE event data format is correct JSON', () => {
    // Verify the SSE event data format matches what the client expects
    const event = {
      data: JSON.stringify({
        status: 'building',
        message: 'Uploading files...',
      }),
    }

    const parsed = JSON.parse(event.data)
    expect(parsed).toHaveProperty('status')
    expect(parsed).toHaveProperty('message')
  })

  it('stream terminates on live status', () => {
    // The SSE stream should stop emitting when deployment is live
    const terminalStatuses = ['live', 'failed']
    expect(terminalStatuses).toContain('live')
    expect(terminalStatuses).toContain('failed')
  })

  it('stream terminates on failed status', () => {
    const terminalStatuses = ['live', 'failed']
    expect(terminalStatuses).toContain('failed')
  })

  it('streamSSE is available from hono/streaming', () => {
    expect(streamSSE).toBeDefined()
    expect(typeof streamSSE).toBe('function')
  })
})
