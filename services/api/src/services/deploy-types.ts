export type DeployTarget = 'cloudflare' | 'herenow' | 'railway'

export interface DeployResult {
  id: string
  url: string
}

export interface DeployStatusResult {
  id: string
  url: string
  stage: string  // 'building' | 'deploying' | 'live' | 'failed'
}

export interface DeployService {
  deploy(projectName: string, files: Record<string, string>): Promise<DeployResult>
  getStatus(projectName: string, deploymentId: string): Promise<DeployStatusResult>
}
