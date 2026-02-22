import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { deployments, projects } from '../db/schema'
import { nanoid } from 'nanoid'
import { CloudflareService } from '../services/cloudflare'
import { HereNowService } from '../services/herenow'
import { RailwayService } from '../services/railway'
import type { DeployTarget, DeployService } from '../services/deploy-types'
import type { Database } from '../db/client'

type Bindings = {
  CF_ACCOUNT_ID: string
  CF_API_TOKEN: string
  HERENOW_API_TOKEN: string
  RAILWAY_API_TOKEN: string
}

type Variables = {
  db: Database
}

function createDeployService(target: DeployTarget, env: Bindings): DeployService {
  switch (target) {
    case 'cloudflare':
      return new CloudflareService(env.CF_ACCOUNT_ID, env.CF_API_TOKEN)
    case 'herenow':
      return new HereNowService(env.HERENOW_API_TOKEN || undefined)
    case 'railway':
      return new RailwayService(env.RAILWAY_API_TOKEN)
  }
}

const deployRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

deployRouter.post(
  '/',
  zValidator('json', z.object({
    projectId: z.string(),
    target: z.enum(['cloudflare', 'herenow', 'railway']).default('cloudflare'),
  })),
  async (c) => {
    const db = c.get('db')
    const { projectId, target } = c.req.valid('json')

    // Get project
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get()
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    if (!project.code) {
      return c.json({ error: 'No code to deploy' }, 400)
    }

    // Create deployment record
    const deploymentId = nanoid()
    await db.insert(deployments).values({
      id: deploymentId,
      projectId,
      target,
      status: 'pending',
    })

    // Deploy in background using the appropriate service
    const service = createDeployService(target, c.env)
    const projectSlug = project.name.toLowerCase().replace(/\s+/g, '-')
    const codeFiles: Record<string, string> = JSON.parse(project.code)

    // Fire and forget — status is polled via GET /:id or SSE /:id/stream
    ;(async () => {
      try {
        await db.update(deployments)
          .set({ status: 'building' })
          .where(eq(deployments.id, deploymentId))

        await db.update(deployments)
          .set({ status: 'deploying' })
          .where(eq(deployments.id, deploymentId))

        const deployment = await service.deploy(projectSlug, codeFiles)
        const url = deployment.url

        await db.update(deployments)
          .set({ status: 'live', url })
          .where(eq(deployments.id, deploymentId))

        await db.update(projects)
          .set({ status: 'deployed', deploymentUrl: url })
          .where(eq(projects.id, projectId))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Deployment failed'
        await db.update(deployments)
          .set({ status: 'failed', logs: message })
          .where(eq(deployments.id, deploymentId))
      }
    })()

    return c.json({
      deploymentId,
      target,
      status: 'pending',
      message: 'Deployment started',
    }, 202)
  }
)

// Get deployment status
deployRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const deployment = await db.select().from(deployments).where(eq(deployments.id, id)).get()
  if (!deployment) {
    return c.json({ error: 'Deployment not found' }, 404)
  }

  return c.json(deployment)
})

// SSE stream for deployment status updates
deployRouter.get('/:id/stream', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  return streamSSE(c, async (stream) => {
    const terminalStatuses = new Set(['live', 'failed'])
    let lastStatus = ''

    for (let i = 0; i < 60; i++) {
      const deployment = await db.select().from(deployments).where(eq(deployments.id, id)).get()

      if (!deployment) {
        await stream.writeSSE({
          data: JSON.stringify({ status: 'error', message: 'Deployment not found' }),
        })
        return
      }

      // Only emit when status changes
      if (deployment.status !== lastStatus) {
        lastStatus = deployment.status ?? ''
        await stream.writeSSE({
          data: JSON.stringify({
            status: deployment.status,
            url: deployment.url,
            message: `Deployment ${deployment.status}`,
          }),
        })
      }

      if (terminalStatuses.has(deployment.status ?? '')) {
        return
      }

      // Poll every 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    // Timeout after 2 minutes
    await stream.writeSSE({
      data: JSON.stringify({ status: 'error', message: 'Deployment timed out' }),
    })
  })
})

export { deployRouter }
