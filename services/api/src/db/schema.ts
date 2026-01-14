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
