import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { tokenLaunches, projects } from '../db/schema'
import { nanoid } from 'nanoid'
import type { Database } from '../db/client'

type Variables = {
  db: Database
}

const tokensRouter = new Hono<{ Variables: Variables }>()

// Launch token
tokensRouter.post(
  '/launch',
  zValidator('json', z.object({
    projectId: z.string(),
    name: z.string().min(1).max(50),
    symbol: z.string().min(1).max(10),
    imageUri: z.string().optional(),
  })),
  async (c) => {
    const db = c.get('db')
    const { projectId, name, symbol, imageUri } = c.req.valid('json')

    // Check project exists and is deployed
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get()
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    if (project.status !== 'deployed') {
      return c.json({ error: 'Project must be deployed before launching token' }, 400)
    }

    // Create token launch record
    const launchId = nanoid()
    await db.insert(tokenLaunches).values({
      id: launchId,
      projectId,
      name,
      symbol: symbol.toUpperCase(),
      imageUri,
    })

    // NOTE: Actual token creation happens on frontend via wallet
    // This just records the intent and will be updated with txHash

    return c.json({
      launchId,
      message: 'Token launch initiated - complete transaction in wallet',
    }, 202)
  }
)

// Update token after on-chain creation
tokensRouter.patch(
  '/:id',
  zValidator('json', z.object({
    tokenAddress: z.string(),
    txHash: z.string(),
  })),
  async (c) => {
    const db = c.get('db')
    const id = c.req.param('id')
    const { tokenAddress, txHash } = c.req.valid('json')

    await db.update(tokenLaunches)
      .set({ tokenAddress, txHash })
      .where(eq(tokenLaunches.id, id))

    // Update project status
    const launch = await db.select().from(tokenLaunches).where(eq(tokenLaunches.id, id)).get()
    if (launch && launch.projectId) {
      await db.update(projects)
        .set({ status: 'launched', tokenAddress })
        .where(eq(projects.id, launch.projectId))
    }

    return c.json({ success: true })
  }
)

export { tokensRouter }
