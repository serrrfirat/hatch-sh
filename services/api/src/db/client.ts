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

// In-memory mock database for local development
type MockStore = {
  users: Record<string, unknown>[]
  projects: Record<string, unknown>[]
  chatMessages: Record<string, unknown>[]
  deployments: Record<string, unknown>[]
  tokenLaunches: Record<string, unknown>[]
}

const mockStore: MockStore = {
  users: [],
  projects: [],
  chatMessages: [],
  deployments: [],
  tokenLaunches: [],
}

// Map table objects to their names
const tableNameMap = new Map<unknown, keyof MockStore>()
tableNameMap.set(schema.users, 'users')
tableNameMap.set(schema.projects, 'projects')
tableNameMap.set(schema.chatMessages, 'chatMessages')
tableNameMap.set(schema.deployments, 'deployments')
tableNameMap.set(schema.tokenLaunches, 'tokenLaunches')

function getTableName(table: unknown): keyof MockStore {
  return tableNameMap.get(table) || 'projects'
}

/**
 * Extract ID value from drizzle-orm eq() expression using JSON serialization.
 *
 * WARNING: This is a fragile implementation for MOCK DATABASE ONLY.
 * It relies on drizzle-orm's internal JSON serialization format which may change.
 * This approach should NEVER be used in production code.
 *
 * For production, use the real drizzle database client which handles
 * condition parsing properly through its native query builder.
 */
function extractIdFromCondition(condition: unknown): string | null {
  if (!condition) return null
  try {
    // Serialize to JSON and find the value field
    const json = JSON.stringify(condition)
    // Look for "value":"some-id-value" pattern
    const match = json.match(/"value":"([^"]+)"/)
    if (match) return match[1]
  } catch {
    // Ignore serialization errors
  }
  return null
}

// Create a chainable query builder for complex queries
function createQueryBuilder(tableName: keyof MockStore) {
  let records = [...mockStore[tableName]]

  const builder = {
    leftJoin: () => builder,
    innerJoin: () => builder,
    orderBy: () => builder,
    where: () => builder,
    limit: () => builder,
    offset: () => builder,
    all: () => Promise.resolve(records.map(r => ({ project: r, token: null }))),
    get: () => Promise.resolve(records[0] ? { project: records[0], token: null } : null),
  }

  return builder
}

export function createMockDb(): Database {
  const mockDb = {
    insert: (table: unknown) => ({
      values: (data: Record<string, unknown>) => {
        const tableName = getTableName(table)
        const record = { ...data, createdAt: new Date(), updatedAt: new Date() }
        mockStore[tableName].push(record)
        return Promise.resolve()
      },
    }),
    select: (fields?: unknown) => ({
      from: (table: unknown) => {
        const tableName = getTableName(table)
        // If selecting specific fields (complex query), use chainable builder
        if (fields && typeof fields === 'object') {
          return createQueryBuilder(tableName)
        }
        // Simple select
        return {
          leftJoin: () => createQueryBuilder(tableName),
          where: (condition: unknown) => ({
            get: () => {
              const id = extractIdFromCondition(condition)
              const record = mockStore[tableName].find((r) => r.id === id)
              return Promise.resolve(record || null)
            },
            orderBy: () => ({
              all: () => Promise.resolve([...mockStore[tableName]]),
              get: () => Promise.resolve(mockStore[tableName][0] || null),
            }),
          }),
          all: () => Promise.resolve([...mockStore[tableName]]),
          get: () => Promise.resolve(mockStore[tableName][0] || null),
        }
      },
    }),
    update: (table: unknown) => ({
      set: (updates: Record<string, unknown>) => ({
        where: (condition: unknown) => {
          const tableName = getTableName(table)
          const id = extractIdFromCondition(condition)
          const idx = mockStore[tableName].findIndex((r) => r.id === id)
          if (idx !== -1) {
            mockStore[tableName][idx] = { ...mockStore[tableName][idx], ...updates }
          }
          return Promise.resolve()
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: (condition: unknown) => {
        const tableName = getTableName(table)
        const id = extractIdFromCondition(condition)
        const idx = mockStore[tableName].findIndex((r) => r.id === id)
        if (idx !== -1) {
          mockStore[tableName].splice(idx, 1)
        }
        return Promise.resolve()
      },
    }),
  }

  return mockDb as unknown as Database
}
