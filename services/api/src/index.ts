import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { projectsRouter } from './routes/projects'
import { chatRouter } from './routes/chat'
import { deployRouter } from './routes/deploy'
import { tokensRouter } from './routes/tokens'
import { discoveryRouter } from './routes/discovery'
import { createDb, type Database } from './db/client'

type Bindings = {
  DATABASE_URL: string
  DATABASE_AUTH_TOKEN: string
  CLAUDE_API_KEY: string
  CF_API_TOKEN: string
  CF_ACCOUNT_ID: string
}

type Variables = {
  db: Database
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://vibed.fun'],
  credentials: true,
}))

// Database middleware
app.use('*', async (c, next) => {
  const db = createDb(c.env.DATABASE_URL, c.env.DATABASE_AUTH_TOKEN)
  c.set('db', db)
  await next()
})

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'vibed-api' }))

// Routes
app.route('/api/projects', projectsRouter)
app.route('/api/chat', chatRouter)
app.route('/api/deploy', deployRouter)
app.route('/api/tokens', tokensRouter)
app.route('/api/discovery', discoveryRouter)

export default app
