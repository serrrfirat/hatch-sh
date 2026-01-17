import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { deployments, projects } from '../db/schema'
import { nanoid } from 'nanoid'
import type { Database } from '../db/client'

type Variables = {
  db: Database
}

const deployRouter = new Hono<{ Variables: Variables }>()

deployRouter.post(
  '/',
  zValidator('json', z.object({
    projectId: z.string(),
  })),
  async (c) => {
    const db = c.get('db')
    const { projectId } = c.req.valid('json')

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
      status: 'pending',
    })

    // TODO: Trigger actual deployment to Cloudflare Workers
    // This will be handled by the deploy service

    // For now, simulate deployment
    setTimeout(async () => {
      const url = `https://${project.name.toLowerCase().replace(/\s+/g, '-')}.hatch.sh`
      await db.update(deployments)
        .set({ status: 'live', url })
        .where(eq(deployments.id, deploymentId))

      await db.update(projects)
        .set({ status: 'deployed', deploymentUrl: url })
        .where(eq(projects.id, projectId))
    }, 3000)

    return c.json({
      deploymentId,
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

export { deployRouter }
