import type { DeployService, DeployResult, DeployStatusResult } from './deploy-types'

export class HereNowService implements DeployService {
  private apiToken: string | undefined
  private baseUrl = 'https://here.now/api'

  constructor(apiToken?: string) {
    this.apiToken = apiToken
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiToken) {
      h['Authorization'] = `Bearer ${this.apiToken}`
    }
    return h
  }

  async deploy(projectName: string, files: Record<string, string>): Promise<DeployResult> {
    const response = await fetch(`${this.baseUrl}/deploy`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ name: projectName, files }),
    })

    if (!response.ok) {
      const body = await response.json() as { error?: string }
      throw new Error(body.error || 'here.now deploy failed')
    }

    const data = await response.json() as { id: string; url: string }
    return { id: data.id, url: data.url }
  }

  async getStatus(projectName: string, deploymentId: string): Promise<DeployStatusResult> {
    const response = await fetch(`${this.baseUrl}/deployments/${deploymentId}`, {
      headers: this.headers,
    })

    if (!response.ok) {
      const body = await response.json() as { error?: string }
      throw new Error(body.error || 'here.now status check failed')
    }

    const data = await response.json() as { id: string; url: string; status: string }

    // Normalize here.now statuses to our stage names
    const stageMap: Record<string, string> = {
      uploading: 'building',
      processing: 'deploying',
      live: 'live',
      failed: 'failed',
    }

    return {
      id: data.id,
      url: data.url,
      stage: stageMap[data.status] ?? data.status,
    }
  }
}
