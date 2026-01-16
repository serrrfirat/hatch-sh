# Agent Task: Backend API Service

## Priority: HIGH - Independent
## Estimated Time: 3-4 hours

## Objective
Build the backend API using Hono on Cloudflare Workers with database integration for projects, users, and deployments.

## Tasks

### 1. Initialize API Service
```bash
mkdir -p services/api
cd services/api
pnpm init
pnpm add hono @hono/zod-validator zod
pnpm add drizzle-orm @libsql/client
pnpm add -D wrangler drizzle-kit typescript @types/node
```

### 2. Create Wrangler Configuration
Create `services/api/wrangler.toml`:
```toml
name = "vibed-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "development"

# For local development
[dev]
port = 8787

# KV namespace for session storage (optional)
# [[kv_namespaces]]
# binding = "SESSIONS"
# id = "xxx"
```

### 3. Create Database Schema
Create `services/api/src/db/schema.ts`:
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  walletAddress: text('wallet_address').unique(),
  email: text('email'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  code: text('code'), // Generated code stored as JSON
  status: text('status').$type<'draft' | 'deployed' | 'launched'>().default('draft'),
  deploymentUrl: text('deployment_url'),
  tokenAddress: text('token_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  role: text('role').$type<'user' | 'assistant'>().notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export const deployments = sqliteTable('deployments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  status: text('status').$type<'pending' | 'building' | 'deploying' | 'live' | 'failed'>().default('pending'),
  url: text('url'),
  logs: text('logs'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export const tokenLaunches = sqliteTable('token_launches', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  tokenAddress: text('token_address'),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  imageUri: text('image_uri'),
  txHash: text('tx_hash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})
```

### 4. Create Database Client
Create `services/api/src/db/client.ts`:
```typescript
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

// For Turso (recommended for edge)
export function createDb(url: string, authToken?: string) {
  const client = createClient({
    url,
    authToken,
  })
  return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDb>
```

### 5. Create Main API Entry Point
Create `services/api/src/index.ts`:
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { projectsRouter } from './routes/projects'
import { chatRouter } from './routes/chat'
import { deployRouter } from './routes/deploy'
import { tokensRouter } from './routes/tokens'
import { discoveryRouter } from './routes/discovery'
import { createDb } from './db/client'

type Bindings = {
  DATABASE_URL: string
  DATABASE_AUTH_TOKEN: string
  CLAUDE_API_KEY: string
  CF_API_TOKEN: string
  CF_ACCOUNT_ID: string
}

const app = new Hono<{ Bindings: Bindings }>()

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
```

### 6. Create Projects Router
Create `services/api/src/routes/projects.ts`:
```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { projects } from '../db/schema'
import { nanoid } from 'nanoid'

const projectsRouter = new Hono()

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
```

### 7. Create Chat Router (AI Integration)
Create `services/api/src/routes/chat.ts`:
```typescript
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { chatMessages, projects } from '../db/schema'
import { nanoid } from 'nanoid'
import Anthropic from '@anthropic-ai/sdk'

const chatRouter = new Hono()

const SYSTEM_PROMPT = `You are an expert React/TypeScript developer helping users build web applications.

When generating code:
1. Create complete, working React applications
2. Use TypeScript and modern React patterns (hooks, functional components)
3. Include TailwindCSS for styling (assume it's available)
4. Keep apps self-contained in a single file when possible
5. Always export a default App component
6. Make apps visually appealing with good UX

Output format: When providing code, wrap it in a code block with the language specified.

Be concise but helpful. Focus on building what the user asks for.`

chatRouter.post(
  '/',
  zValidator('json', z.object({
    projectId: z.string(),
    message: z.string().min(1),
  })),
  async (c) => {
    const db = c.get('db')
    const { projectId, message } = c.req.valid('json')

    // Get chat history
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .orderBy(chatMessages.createdAt)
      .all()

    // Save user message
    const userMessageId = nanoid()
    await db.insert(chatMessages).values({
      id: userMessageId,
      projectId,
      role: 'user',
      content: message,
    })

    // Build messages for Claude
    const messages = history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))
    messages.push({ role: 'user', content: message })

    // Stream response
    return streamSSE(c, async (stream) => {
      const client = new Anthropic({ apiKey: c.env.CLAUDE_API_KEY })

      let fullResponse = ''

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        stream: true,
      })

      for await (const event of response) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text
          fullResponse += text
          await stream.writeSSE({ data: JSON.stringify({ text }) })
        }
      }

      // Save assistant response
      const assistantMessageId = nanoid()
      await db.insert(chatMessages).values({
        id: assistantMessageId,
        projectId,
        role: 'assistant',
        content: fullResponse,
      })

      // Extract and save code to project
      const codeMatch = fullResponse.match(/```(?:tsx?|jsx?|javascript|typescript)?\n([\s\S]*?)```/)
      if (codeMatch) {
        await db.update(projects)
          .set({ code: codeMatch[1], updatedAt: new Date() })
          .where(eq(projects.id, projectId))
      }

      await stream.writeSSE({ data: JSON.stringify({ done: true }) })
    })
  }
)

// Get chat history
chatRouter.get('/:projectId', async (c) => {
  const db = c.get('db')
  const projectId = c.req.param('projectId')

  const history = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(chatMessages.createdAt)
    .all()

  return c.json(history)
})

export { chatRouter }
```

### 8. Create Deploy Router (Scaffold)
Create `services/api/src/routes/deploy.ts`:
```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { deployments, projects } from '../db/schema'
import { nanoid } from 'nanoid'

const deployRouter = new Hono()

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
      const url = `https://${project.name.toLowerCase().replace(/\s+/g, '-')}.vibed.fun`
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
```

### 9. Create Tokens Router
Create `services/api/src/routes/tokens.ts`:
```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { tokenLaunches, projects } from '../db/schema'
import { nanoid } from 'nanoid'

const tokensRouter = new Hono()

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
    if (launch) {
      await db.update(projects)
        .set({ status: 'launched', tokenAddress })
        .where(eq(projects.id, launch.projectId))
    }

    return c.json({ success: true })
  }
)

export { tokensRouter }
```

### 10. Create Discovery Router
Create `services/api/src/routes/discovery.ts`:
```typescript
import { Hono } from 'hono'
import { eq, desc, sql } from 'drizzle-orm'
import { projects, tokenLaunches, users } from '../db/schema'

const discoveryRouter = new Hono()

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
```

### 11. Add Dependencies and Scripts
Update `services/api/package.json`:
```json
{
  "name": "vibed-api",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "@hono/zod-validator": "^0.2.0",
    "@libsql/client": "^0.6.0",
    "drizzle-orm": "^0.30.0",
    "hono": "^4.3.0",
    "nanoid": "^5.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "drizzle-kit": "^0.21.0",
    "typescript": "^5.4.0",
    "wrangler": "^3.50.0"
  }
}
```

## Directory Structure
```
services/api/
├── package.json
├── wrangler.toml
├── tsconfig.json
├── drizzle.config.ts
├── src/
│   ├── index.ts
│   ├── db/
│   │   ├── schema.ts
│   │   └── client.ts
│   ├── routes/
│   │   ├── projects.ts
│   │   ├── chat.ts
│   │   ├── deploy.ts
│   │   ├── tokens.ts
│   │   └── discovery.ts
│   ├── middleware/
│   │   └── auth.ts (TODO)
│   └── services/
│       └── claude.ts (extracted from chat)
└── migrations/
```

## Definition of Done
- [ ] `pnpm dev` starts API on port 8787
- [ ] Can create/list projects via curl
- [ ] Chat endpoint streams Claude responses
- [ ] Deploy endpoint creates deployment records
- [ ] Discovery endpoint returns launched apps
- [ ] Database schema migrated

## Environment Variables Needed
```
DATABASE_URL=libsql://your-turso-db.turso.io
DATABASE_AUTH_TOKEN=your-turso-auth-token
CLAUDE_API_KEY=your-claude-api-key
CF_API_TOKEN=your-cloudflare-api-token
CF_ACCOUNT_ID=your-cloudflare-account-id
```

## Notes
- Use Turso for SQLite at edge (free tier available)
- Or use Supabase if PostgreSQL preferred
- Auth middleware to be added once Privy integration is done
- Deploy service integration is scaffolded - actual CF deployment is separate module
