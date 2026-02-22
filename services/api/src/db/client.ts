import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

// For Turso (production/staging)
export function createDb(url: string, authToken?: string) {
  const client = createClient({
    url,
    authToken,
  })
  return drizzle(client, { schema })
}

// For local development — uses a SQLite file
export function createLocalDb() {
  const client = createClient({
    url: 'file:./hatch-dev.db',
  })
  return drizzle(client, { schema })
}

export type Database = ReturnType<typeof createDb>
