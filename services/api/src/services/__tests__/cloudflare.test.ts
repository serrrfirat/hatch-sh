import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CloudflareService } from '../cloudflare'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('CloudflareService', () => {
  let service: CloudflareService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CloudflareService('test-account-id', 'test-api-token')
  })

  it('createPagesProject calls CF API with correct account ID and project name', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: { name: 'my-project', subdomain: 'my-project' },
      }),
    })

    const result = await service.createPagesProject('my-project')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/test-account-id/pages/projects',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-token',
        }),
      })
    )
    expect(result.name).toBe('my-project')
  })

  it('uploadFiles calls Direct Upload API with FormData', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: { id: 'deploy-1', url: 'https://deploy-1.pages.dev' },
      }),
    })

    const files = { 'index.html': '<h1>Hello</h1>', 'app.js': 'console.log("hi")' }
    const result = await service.uploadFiles('my-project', files)

    expect(mockFetch).toHaveBeenCalled()
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain('pages/projects/my-project/deployments')
    expect(result.id).toBe('deploy-1')
  })

  it('getDeploymentStatus returns deployment status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: { id: 'deploy-1', latest_stage: { name: 'deploy', status: 'active' }, url: 'https://...' },
      }),
    })

    const result = await service.getDeploymentStatus('my-project', 'deploy-1')
    expect(result.id).toBe('deploy-1')
  })

  it('createPagesProject throws on CF API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({
        success: false,
        errors: [{ message: 'bad request' }],
      }),
    })

    await expect(service.createPagesProject('bad-project')).rejects.toThrow('bad request')
  })

  it('uploadFiles throws on CF API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({
        success: false,
        errors: [{ message: 'upload failed' }],
      }),
    })

    await expect(service.uploadFiles('proj', { 'index.html': '<h1/>' })).rejects.toThrow('upload failed')
  })

  it('getDeploymentStatus throws on CF API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({
        success: false,
        errors: [{ message: 'not found' }],
      }),
    })

    await expect(service.getDeploymentStatus('proj', 'bad-id')).rejects.toThrow('not found')
  })

  it('deployment flow: create project -> upload -> poll status', async () => {
    // Create project
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: { name: 'test-project', subdomain: 'test-project' },
      }),
    })
    // Upload files
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: { id: 'deploy-1', url: 'https://deploy-1.test-project.pages.dev' },
      }),
    })
    // Get status
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: { id: 'deploy-1', latest_stage: { name: 'deploy', status: 'success' }, url: 'https://test-project.pages.dev' },
      }),
    })

    await service.createPagesProject('test-project')
    const deployment = await service.uploadFiles('test-project', { 'index.html': '<h1/>' })
    const status = await service.getDeploymentStatus('test-project', deployment.id)

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(status.url).toContain('test-project')
  })
})
