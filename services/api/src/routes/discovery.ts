import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { projects, tokenLaunches } from '../db/schema'
import type { Database } from '../db/client'

type Variables = {
  db: Database
}

const discoveryRouter = new Hono<{ Variables: Variables }>()

// List all launched apps
discoveryRouter.get('/', async (c) => {
  const db = c.get('db')
  const sortBy = c.req.query('sort') || 'recent'

  // Get projects with tokens
  const launchedProjects = await db
    .select({
      project: projects,
      token: tokenLaunches,
    })
    .from(projects)
    .leftJoin(tokenLaunches, eq(projects.id, tokenLaunches.projectId))
    .where(eq(projects.status, 'launched'))
    .orderBy(desc(projects.createdAt))
    .all()

  // Transform for frontend
  const apps = launchedProjects.map(({ project, token }) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    deploymentUrl: project.deploymentUrl,
    createdAt: project.createdAt,
    token: token ? {
      address: token.tokenAddress,
      name: token.name,
      symbol: token.symbol,
      imageUri: token.imageUri,
    } : null,
  }))

  return c.json(apps)
})

// Get single app details
discoveryRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const result = await db
    .select({
      project: projects,
      token: tokenLaunches,
    })
    .from(projects)
    .leftJoin(tokenLaunches, eq(projects.id, tokenLaunches.projectId))
    .where(eq(projects.id, id))
    .get()

  if (!result) {
    return c.json({ error: 'App not found' }, 404)
  }

  return c.json({
    ...result.project,
    token: result.token,
  })
})

export { discoveryRouter }
