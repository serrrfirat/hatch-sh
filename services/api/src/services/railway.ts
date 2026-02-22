import type { DeployService, DeployResult, DeployStatusResult } from './deploy-types'

export class RailwayService implements DeployService {
  private apiToken: string
  private baseUrl = 'https://backboard.railway.com/graphql/v2'

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      throw new Error(`Railway API request failed: ${response.status}`)
    }

    const data = await response.json() as { data?: T; errors?: { message: string }[] }
    if (data.errors?.length) {
      throw new Error(data.errors[0].message)
    }
    if (!data.data) {
      throw new Error('Railway API returned empty response')
    }
    return data.data
  }

  async deploy(projectName: string, files: Record<string, string>): Promise<DeployResult> {
    // Create project
    const projectResult = await this.graphql<{
      projectCreate: { id: string }
    }>(
      `mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { id } }`,
      { input: { name: projectName } }
    )
    const projectId = projectResult.projectCreate.id

    // Create service within the project
    const serviceResult = await this.graphql<{
      serviceCreate: { id: string }
    }>(
      `mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }`,
      { input: { projectId, name: projectName } }
    )
    const serviceId = serviceResult.serviceCreate.id

    // Trigger deployment with files
    const deployResult = await this.graphql<{
      deploymentCreate: { id: string; staticUrl: string }
    }>(
      `mutation($input: DeploymentCreateInput!) { deploymentCreate(input: $input) { id staticUrl } }`,
      { input: { serviceId, projectId, files } }
    )

    return {
      id: deployResult.deploymentCreate.id,
      url: deployResult.deploymentCreate.staticUrl,
    }
  }

  async getStatus(_projectName: string, deploymentId: string): Promise<DeployStatusResult> {
    const result = await this.graphql<{
      deployment: { id: string; status: string; staticUrl: string }
    }>(
      `query($id: String!) { deployment(id: $id) { id status staticUrl } }`,
      { id: deploymentId }
    )

    const { deployment } = result

    // Normalize Railway statuses to our stage names
    const stageMap: Record<string, string> = {
      INITIALIZING: 'building',
      BUILDING: 'building',
      DEPLOYING: 'deploying',
      SUCCESS: 'live',
      FAILED: 'failed',
      CRASHED: 'failed',
      REMOVED: 'failed',
    }

    return {
      id: deployment.id,
      url: deployment.staticUrl,
      stage: stageMap[deployment.status] ?? deployment.status,
    }
  }
}
