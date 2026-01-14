import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { projects } from '../db/schema'
import { nanoid } from 'nanoid'
import type { Database } from '../db/client'

type Variables = {
  db: Database
}

const projectsRouter = new Hono<{ Variables: Variables }>()

// Create project
projectsRouter.post(
  '/',
  zValidator('json', z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
  })),
  async (c) => {
    const db = c.get('db')
    const { name, description } = c.req.valid('json')
    // TODO: Get userId from auth
    const userId = 'temp-user'

    const id = nanoid()
    await db.insert(projects).values({
      id,
      userId,
      name,
      description,
    })

    const project = await db.select().from(projects).where(eq(projects.id, id)).get()
    return c.json(project, 201)
  }
)

// List projects
projectsRouter.get('/', async (c) => {
  const db = c.get('db')
  // TODO: Filter by userId from auth
  const allProjects = await db.select().from(projects).all()
  return c.json(allProjects)
})

// Get project by ID
projectsRouter.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const project = await db.select().from(projects).where(eq(projects.id, id)).get()
  if (!project) {
    return c.json({ error: 'Project not found' }, 404)
  }
  return c.json(project)
})

// Update project
projectsRouter.patch(
  '/:id',
  zValidator('json', z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    code: z.string().optional(),
  })),
  async (c) => {
    const db = c.get('db')
    const id = c.req.param('id')
    const updates = c.req.valid('json')

    await db.update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))

    const project = await db.select().from(projects).where(eq(projects.id, id)).get()
    return c.json(project)
  }
)

export { projectsRouter }
