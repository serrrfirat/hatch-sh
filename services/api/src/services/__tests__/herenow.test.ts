import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HereNowService } from '../herenow'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('HereNowService', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('deploy', () => {
    it('should deploy files and return result', async () => {
      const service = new HereNowService('test-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'dep-123', url: 'https://abc.here.now' }),
      })

      const result = await service.deploy('my-project', { 'index.html': '<h1>Hi</h1>' })

      expect(result).toEqual({ id: 'dep-123', url: 'https://abc.here.now' })
      expect(mockFetch).toHaveBeenCalledWith('https://here.now/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({ name: 'my-project', files: { 'index.html': '<h1>Hi</h1>' } }),
      })
    })

    it('should work without a token (anonymous deploy)', async () => {
      const service = new HereNowService()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'dep-456', url: 'https://xyz.here.now' }),
      })

      const result = await service.deploy('anon-project', { 'index.html': '<p>Test</p>' })

      expect(result).toEqual({ id: 'dep-456', url: 'https://xyz.here.now' })
      // No Authorization header when no token
      expect(mockFetch).toHaveBeenCalledWith('https://here.now/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      })
    })

    it('should throw on API error', async () => {
      const service = new HereNowService('test-token')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Rate limited' }),
      })

      await expect(service.deploy('proj', {})).rejects.toThrow('Rate limited')
    })
  })

  describe('getStatus', () => {
    it('should return normalized status', async () => {
      const service = new HereNowService('test-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'dep-123', url: 'https://abc.here.now', status: 'live' }),
      })

      const result = await service.getStatus('my-project', 'dep-123')

      expect(result).toEqual({
        id: 'dep-123',
        url: 'https://abc.here.now',
        stage: 'live',
      })
    })

    it('should normalize uploading → building', async () => {
      const service = new HereNowService()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'dep-1', url: '', status: 'uploading' }),
      })

      const result = await service.getStatus('proj', 'dep-1')
      expect(result.stage).toBe('building')
    })

    it('should normalize processing → deploying', async () => {
      const service = new HereNowService()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'dep-1', url: '', status: 'processing' }),
      })

      const result = await service.getStatus('proj', 'dep-1')
      expect(result.stage).toBe('deploying')
    })

    it('should throw on status check error', async () => {
      const service = new HereNowService('test-token')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      })

      await expect(service.getStatus('proj', 'bad-id')).rejects.toThrow('Not found')
    })
  })
})
