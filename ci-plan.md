# CI/CD Implementation Plan

This document tracks the implementation of CI/CD pipelines and E2E testing for the hatch.sh monorepo.

---

## Phase 1: Foundation (COMPLETED)

### What was implemented:

- **ESLint** (`eslint.config.js`) - Flat config with TypeScript + React support
- **Prettier** (`.prettierrc`, `.prettierignore`) - Code formatting
- **Vitest** (`vitest.config.ts`, `vitest.workspace.ts`) - Test framework
- **GitHub Actions** (`.github/workflows/ci.yml`) - CI workflow
- **Scripts** - Added to all package.json files:
  - `lint`, `lint:fix`, `format`, `format:check`
  - `typecheck`, `test`, `test:watch`, `test:coverage`

### Verification:

```bash
pnpm run ci  # Runs: lint → typecheck → build → test
```

All steps pass with 32 warnings (0 errors).

---

## Phase 2: Unit & Integration Tests

### Goal
Add unit tests for API routes and integration tests with mock database.

### Tasks

#### 2.1 Install Hono testing utilities
```bash
cd services/api
pnpm add -D @hono/node-server
```

#### 2.2 Create test helpers
Create `services/api/src/__tests__/helpers.ts`:
```typescript
import { testClient } from 'hono/testing'
import app from '../index'

export function createTestApp() {
  // Set up mock environment
  const mockEnv = {
    DATABASE_URL: '',
    DATABASE_AUTH_TOKEN: '',
    CLAUDE_API_KEY: 'test-key',
    CF_API_TOKEN: 'test-token',
    CF_ACCOUNT_ID: 'test-account',
    ENVIRONMENT: 'development',
  }

  return testClient(app, mockEnv)
}
```

#### 2.3 Write API tests

**Projects API** (`services/api/src/__tests__/projects.test.ts`):
```typescript
import { describe, it, expect } from 'vitest'
import { createTestApp } from './helpers'

describe('Projects API', () => {
  const client = createTestApp()

  describe('POST /api/projects', () => {
    it('creates a project with valid data', async () => {
      const res = await client.api.projects.$post({
        json: { name: 'Test Project', description: 'A test' }
      })
      expect(res.status).toBe(201)
    })

    it('returns 400 for empty name', async () => {
      const res = await client.api.projects.$post({
        json: { name: '' }
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/projects', () => {
    it('returns array of projects', async () => {
      const res = await client.api.projects.$get()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
    })
  })
})
```

**Deploy API** (`services/api/src/__tests__/deploy.test.ts`):
```typescript
import { describe, it, expect } from 'vitest'
import { createTestApp } from './helpers'

describe('Deploy API', () => {
  const client = createTestApp()

  describe('POST /api/deploy', () => {
    it('returns 404 for unknown project', async () => {
      const res = await client.api.deploy.$post({
        json: { projectId: 'nonexistent' }
      })
      expect(res.status).toBe(404)
    })
  })
})
```

**Discovery API** (`services/api/src/__tests__/discovery.test.ts`):
```typescript
import { describe, it, expect } from 'vitest'
import { createTestApp } from './helpers'

describe('Discovery API', () => {
  const client = createTestApp()

  describe('GET /api/discovery', () => {
    it('returns launched apps', async () => {
      const res = await client.api.discovery.$get()
      expect(res.status).toBe(200)
    })
  })
})
```

#### 2.4 Add test script to API package
Update `services/api/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

#### 2.5 Update CI to run tests per-package
The existing CI workflow already runs `pnpm test` which uses the workspace Vitest config.

---

## Phase 3: API E2E Tests

### Goal
Full API flow tests against a real (test) database.

### Tasks

#### 3.1 Set up test database
Option A: Use Turso test instance
```bash
turso db create hatch-test
turso db tokens create hatch-test
```

Option B: Use local SQLite for tests
```typescript
// vitest.config.ts for API
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'file:./test.db',
    }
  }
})
```

#### 3.2 Create E2E test directory
```
services/api/
└── e2e/
    ├── setup.ts          # DB setup/teardown
    ├── projects.e2e.ts   # Full project lifecycle
    ├── chat.e2e.ts       # Chat with mocked Claude
    └── deploy.e2e.ts     # Deploy flow
```

#### 3.3 Migrate existing bash script
Convert `scripts/e2e-test.sh` to Playwright or Vitest:

```typescript
// services/api/e2e/api.e2e.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const API_URL = process.env.API_URL || 'http://localhost:8787'

describe('API E2E', () => {
  beforeAll(async () => {
    // Wait for API to be ready
    await fetch(`${API_URL}/`)
  })

  it('health check returns ok', async () => {
    const res = await fetch(`${API_URL}/`)
    const data = await res.json()
    expect(data.status).toBe('ok')
  })

  it('full project lifecycle', async () => {
    // Create project
    const createRes = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Test', description: 'Test' })
    })
    expect(createRes.status).toBe(201)
    const project = await createRes.json()

    // Get project
    const getRes = await fetch(`${API_URL}/api/projects/${project.id}`)
    expect(getRes.status).toBe(200)

    // Update project
    const updateRes = await fetch(`${API_URL}/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated E2E Test' })
    })
    expect(updateRes.status).toBe(200)
  })
})
```

#### 3.4 Add E2E workflow
Create `.github/workflows/e2e.yml`:
```yaml
name: E2E Tests

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Start API
        run: pnpm dev:api &
        env:
          DATABASE_URL: ${{ secrets.TURSO_TEST_URL }}
          DATABASE_AUTH_TOKEN: ${{ secrets.TURSO_TEST_TOKEN }}

      - name: Wait for API
        run: npx wait-on http://localhost:8787

      - name: Run E2E tests
        run: pnpm --filter hatch-api test:e2e
```

---

## Phase 4: Desktop E2E Tests

### Goal
Automated testing of the desktop app using Playwright + Tauri.

### Tasks

#### 4.1 Install Playwright for Tauri
```bash
cd apps/desktop
pnpm add -D @playwright/test @tauri-apps/driver
```

#### 4.2 Configure Playwright
Create `apps/desktop/playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'tauri://localhost',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        // Tauri-specific settings
      },
    },
  ],
})
```

#### 4.3 Create desktop E2E tests
```
apps/desktop/
└── e2e/
    ├── fixtures.ts
    ├── app-launch.spec.ts
    ├── project-flow.spec.ts
    └── chat-flow.spec.ts
```

Example test (`apps/desktop/e2e/app-launch.spec.ts`):
```typescript
import { test, expect } from '@playwright/test'

test.describe('App Launch', () => {
  test('opens without crash', async ({ page }) => {
    // Tauri-specific page navigation
    await expect(page).toHaveTitle(/Hatch/)
  })

  test('shows welcome screen', async ({ page }) => {
    await expect(page.getByText('Welcome')).toBeVisible()
  })
})
```

#### 4.4 Add desktop test scripts
Update `apps/desktop/package.json`:
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## Phase 5: Deployment Automation

### Goal
Automated deployments for API and desktop releases.

### Tasks

#### 5.1 API Deployment Workflow
Create `.github/workflows/deploy-api.yml`:
```yaml
name: Deploy API

on:
  push:
    branches: [master]
    paths:
      - 'services/api/**'
      - '.github/workflows/deploy-api.yml'
  workflow_dispatch:

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Deploy to staging
        working-directory: services/api
        run: pnpm wrangler deploy --env staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Run smoke tests
        run: |
          curl -f https://staging-api.hatch.sh/ || exit 1

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Deploy to production
        working-directory: services/api
        run: pnpm wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

#### 5.2 Desktop Release Workflow
Create `.github/workflows/release-desktop.yml`:
```yaml
name: Release Desktop

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-latest
            target: universal-apple-darwin
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
          - os: windows-latest
            target: x86_64-pc-windows-msvc

    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - uses: dtolnay/rust-action@stable

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: 'apps/desktop/src-tauri -> target'

      - run: pnpm install --frozen-lockfile

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS signing (optional)
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Hatch v__VERSION__'
          releaseBody: 'See the assets to download this version.'
          releaseDraft: true
          prerelease: false
```

#### 5.3 Wrangler environments
Update `services/api/wrangler.toml`:
```toml
name = "hatch-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.staging]
name = "hatch-api-staging"
vars = { ENVIRONMENT = "staging" }

[env.production]
name = "hatch-api"
vars = { ENVIRONMENT = "production" }
```

---

## GitHub Secrets Required

| Secret | Purpose | Phase |
|--------|---------|-------|
| `TURSO_TEST_URL` | Test database URL | 3 |
| `TURSO_TEST_TOKEN` | Test database token | 3 |
| `CLOUDFLARE_API_TOKEN` | Wrangler deployments | 5 |
| `APPLE_CERTIFICATE` | macOS code signing | 5 |
| `APPLE_CERTIFICATE_PASSWORD` | macOS signing | 5 |
| `APPLE_SIGNING_IDENTITY` | macOS signing | 5 |
| `APPLE_ID` | Notarization | 5 |
| `APPLE_PASSWORD` | Notarization | 5 |
| `APPLE_TEAM_ID` | Notarization | 5 |

---

## Test Coverage Targets

| Package | Target | Priority |
|---------|--------|----------|
| `services/api` | 80% | High |
| `packages/ui` | 60% | Medium |
| `apps/desktop` | 50% | Low |
| `packages/acp-client` | 70% | Medium |

---

## Quick Reference

```bash
# Run all CI checks locally
pnpm run ci

# Individual checks
pnpm lint
pnpm typecheck
pnpm build
pnpm test

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Watch mode for tests
pnpm test:watch

# Coverage report
pnpm test:coverage
```
