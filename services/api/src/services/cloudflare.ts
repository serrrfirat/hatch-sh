export interface CFProject {
  name: string
  subdomain: string
}

export interface CFDeployment {
  id: string
  url: string
}

export interface CFDeploymentStatus {
  id: string
  url: string
  latest_stage: { name: string; status: string }
}

export class CloudflareService {
  private accountId: string
  private apiToken: string
  private baseUrl = 'https://api.cloudflare.com/client/v4'

  constructor(accountId: string, apiToken: string) {
    this.accountId = accountId
    this.apiToken = apiToken
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json() as { success: boolean; result: T; errors?: { message: string }[] }
    if (!response.ok || !data.success) {
      throw new Error(data.errors?.[0]?.message || 'Cloudflare API request failed')
    }
    return data.result
  }

  async createPagesProject(name: string): Promise<CFProject> {
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/pages/projects`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          name,
          production_branch: 'main',
        }),
      }
    )

    return this.handleResponse<CFProject>(response)
  }

  async uploadFiles(projectName: string, files: Record<string, string>): Promise<CFDeployment> {
    const formData = new FormData()
    for (const [name, content] of Object.entries(files)) {
      formData.append(name, new Blob([content]), name)
    }

    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiToken}` },
        body: formData,
      }
    )

    return this.handleResponse<CFDeployment>(response)
  }

  async getDeploymentStatus(projectName: string, deploymentId: string): Promise<CFDeploymentStatus> {
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/pages/projects/${projectName}/deployments/${deploymentId}`,
      { headers: this.headers }
    )

    return this.handleResponse<CFDeploymentStatus>(response)
  }
}
