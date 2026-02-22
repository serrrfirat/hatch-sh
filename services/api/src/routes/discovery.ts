import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { projects } from '../db/schema'
import type { Database } from '../db/client'

type Variables = {
  db: Database
}

const discoveryRouter = new Hono<{ Variables: Variables }>()

// List all deployed apps
discoveryRouter.get('/', async (c) => {
  const db = c.get('db')
  const sortBy = c.req.query('sort') || 'recent'

  // Get deployed projects
  const deployedProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.status, 'deployed'))
    .orderBy(desc(projects.createdAt))
    .all()

  // Transform for frontend
  const apps = deployedProjects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    deploymentUrl: project.deploymentUrl,
    createdAt: project.createdAt,
  }))

  return c.json(apps)
})

// Get single app details
discoveryRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get()

  if (!result) {
    return c.json({ error: 'App not found' }, 404)
  }

  return c.json(result)
})

export { discoveryRouter }
