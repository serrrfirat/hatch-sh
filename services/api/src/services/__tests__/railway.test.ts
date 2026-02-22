import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RailwayService } from '../railway'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('RailwayService', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('deploy', () => {
    it('should create project, service, and trigger deployment', async () => {
      const service = new RailwayService('railway-token')

      // projectCreate
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { projectCreate: { id: 'proj-1' } } }),
      })
      // serviceCreate
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { serviceCreate: { id: 'svc-1' } } }),
      })
      // deploymentCreate
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { deploymentCreate: { id: 'dep-1', staticUrl: 'https://my-app.up.railway.app' } },
        }),
      })

      const result = await service.deploy('my-app', { 'index.html': '<h1>Hi</h1>' })

      expect(result).toEqual({ id: 'dep-1', url: 'https://my-app.up.railway.app' })
      expect(mockFetch).toHaveBeenCalledTimes(3)

      // All calls should use the correct auth header
      for (const call of mockFetch.mock.calls) {
        const options = call[1] as RequestInit
        expect(options.headers).toEqual(expect.objectContaining({
          'Authorization': 'Bearer railway-token',
        }))
      }
    })

    it('should throw on GraphQL error', async () => {
      const service = new RailwayService('railway-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errors: [{ message: 'Unauthorized' }] }),
      })

      await expect(service.deploy('app', {})).rejects.toThrow('Unauthorized')
    })

    it('should throw on HTTP error', async () => {
      const service = new RailwayService('railway-token')

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await expect(service.deploy('app', {})).rejects.toThrow('Railway API request failed: 500')
    })
  })

  describe('getStatus', () => {
    it('should normalize SUCCESS → live', async () => {
      const service = new RailwayService('railway-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { deployment: { id: 'dep-1', status: 'SUCCESS', staticUrl: 'https://app.railway.app' } },
        }),
      })

      const result = await service.getStatus('app', 'dep-1')
      expect(result).toEqual({
        id: 'dep-1',
        url: 'https://app.railway.app',
        stage: 'live',
      })
    })

    it('should normalize BUILDING → building', async () => {
      const service = new RailwayService('railway-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { deployment: { id: 'dep-1', status: 'BUILDING', staticUrl: '' } },
        }),
      })

      const result = await service.getStatus('app', 'dep-1')
      expect(result.stage).toBe('building')
    })

    it('should normalize DEPLOYING → deploying', async () => {
      const service = new RailwayService('railway-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { deployment: { id: 'dep-1', status: 'DEPLOYING', staticUrl: '' } },
        }),
      })

      const result = await service.getStatus('app', 'dep-1')
      expect(result.stage).toBe('deploying')
    })

    it('should normalize FAILED → failed', async () => {
      const service = new RailwayService('railway-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { deployment: { id: 'dep-1', status: 'FAILED', staticUrl: '' } },
        }),
      })

      const result = await service.getStatus('app', 'dep-1')
      expect(result.stage).toBe('failed')
    })

    it('should normalize CRASHED → failed', async () => {
      const service = new RailwayService('railway-token')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { deployment: { id: 'dep-1', status: 'CRASHED', staticUrl: '' } },
        }),
      })

      const result = await service.getStatus('app', 'dep-1')
      expect(result.stage).toBe('failed')
    })
  })
})
