import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { projectsRouter } from './routes/projects'
import { chatRouter } from './routes/chat'
import { deployRouter } from './routes/deploy'
import { tokensRouter } from './routes/tokens'
import { discoveryRouter } from './routes/discovery'
import { skillsmpRouter } from './routes/skillsmp'
import { createDb, createMockDb, type Database } from './db/client'

type Bindings = {
  DATABASE_URL: string
  DATABASE_AUTH_TOKEN: string
  CLAUDE_API_KEY: string
  CF_API_TOKEN: string
  CF_ACCOUNT_ID: string
  ENVIRONMENT: string
  SKILLSMP_API_KEY?: string
}

type Variables = {
  db: Database
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://vibed.fun'],
  credentials: true,
}))

// Health check (before database middleware)
app.get('/', (c) => c.json({ status: 'ok', service: 'vibed.fun API' }))

// Database middleware (only for /api routes)
app.use('/api/*', async (c, next) => {
  const isDev = c.env.ENVIRONMENT === 'development'
  const hasValidDbUrl = c.env.DATABASE_URL && c.env.DATABASE_URL.startsWith('libsql://')

  if (isDev && !hasValidDbUrl) {
    // Use mock database for local development
    c.set('db', createMockDb())
  } else {
    const db = createDb(c.env.DATABASE_URL, c.env.DATABASE_AUTH_TOKEN)
    c.set('db', db)
  }
  await next()
})

// Routes
app.route('/api/projects', projectsRouter)
app.route('/api/chat', chatRouter)
app.route('/api/deploy', deployRouter)
app.route('/api/tokens', tokensRouter)
app.route('/api/discovery', discoveryRouter)
app.route('/api/skillsmp', skillsmpRouter)

export default app
