import { createClient } from '@libsql/client'

const client = createClient({ url: 'file:./hatch-dev.db' })

async function migrate() {
  console.log('Running local dev migrations...')

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      code TEXT,
      status TEXT DEFAULT 'draft',
      deployment_url TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      target TEXT DEFAULT 'cloudflare',
      status TEXT DEFAULT 'pending',
      url TEXT,
      logs TEXT,
      created_at INTEGER
    );
  `)

  // Add target column to existing deployments table (safe if already present)
  try {
    await client.execute(`ALTER TABLE deployments ADD COLUMN target TEXT DEFAULT 'cloudflare'`)
    console.log('Added target column to deployments table.')
  } catch {
    // Column already exists — that's fine
  }

  console.log('Migrations complete.')
}

migrate().catch(console.error)
