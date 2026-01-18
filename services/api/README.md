# Hatch API Service

Backend API for hatch.sh - an AI-powered app builder.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HATCH.SH PLATFORM                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKERS (EDGE)                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           HONO API SERVER                             │  │
│  │                                                                       │  │
│  │   ┌─────────┐ ┌──────┐ ┌──────┐ ┌─────────┐ ┌────────┐           │  │
│  │   │Projects │ │ Chat │ │Deploy│ │Discovery│ │ Skills │           │  │
│  │   │ Router  │ │Router│ │Router│ │  Router │ │  MP    │           │  │
│  │   └────┬────┘ └──┬───┘ └──┬───┘ └────┬────┘ └───┬────┘           │  │
│  │        │         │        │          │          │                │  │
│  │        └─────────┴────────┴──────────┴──────────┘                │  │
│  │                             │                                        │  │
│  │                    ┌────────┴────────┐                               │  │
│  │                    │  Database Layer │                               │  │
│  │                    │  (Drizzle ORM)  │                               │  │
│  │                    └────────┬────────┘                               │  │
│  └─────────────────────────────┼─────────────────────────────────────────┘  │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TURSO (SQLite)                                 │
│                         Distributed Edge Database                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Request Flow

### Chat with AI (Code Generation)

```
┌────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│ Client │────▶│  API Server │────▶│   Claude    │────▶│ Database │
└────────┘     └─────────────┘     │    API      │     └──────────┘
    │                │             └─────────────┘          │
    │                │                   │                  │
    │   1. POST /api/chat                │                  │
    │   {projectId, message}             │                  │
    │                │                   │                  │
    │                │  2. Load chat     │                  │
    │                │     history       │                  │
    │                │◀──────────────────┼──────────────────│
    │                │                   │                  │
    │                │  3. Stream to     │                  │
    │                │     Claude API    │                  │
    │                │──────────────────▶│                  │
    │                │                   │                  │
    │  4. SSE Stream │  5. Token stream  │                  │
    │◀───────────────│◀──────────────────│                  │
    │   (real-time)  │                   │                  │
    │                │                   │                  │
    │                │  6. Save response │                  │
    │                │     & extract code│                  │
    │                │──────────────────────────────────────▶│
    │                │                   │                  │
    ▼                ▼                   ▼                  ▼
```

### Deploy Flow

```
┌────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│ Client │────▶│  API Server │────▶│ Cloudflare  │────▶│ Database │
└────────┘     └─────────────┘     │  Workers    │     └──────────┘
    │                │             └─────────────┘          │
    │                │                   │                  │
    │   1. POST /api/deploy              │                  │
    │   {projectId}                      │                  │
    │                │                   │                  │
    │                │  2. Get project   │                  │
    │                │     code          │                  │
    │                │◀─────────────────────────────────────│
    │                │                   │                  │
    │                │  3. Create        │                  │
    │                │     deployment    │                  │
    │                │──────────────────────────────────────▶│
    │                │                   │                  │
    │  4. Return     │  5. Deploy to CF  │                  │
    │◀───────────────│──────────────────▶│                  │
    │  deploymentId  │   (async)         │                  │
    │                │                   │                  │
    │                │  6. Update status │                  │
    │   7. Poll      │◀──────────────────│                  │
    │──────────────▶│                    │                  │
    │   GET /api/deploy/:id              │──────────────────▶│
    │                │                   │                  │
    ▼                ▼                   ▼                  ▼
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE SCHEMA                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    users     │       │     projects     │       │  chat_messages   │
├──────────────┤       ├──────────────────┤       ├──────────────────┤
│ id        PK │◀──────│ user_id       FK │       │ id            PK │
│ wallet_addr  │       │ id            PK │◀──────│ project_id    FK │
│ email        │       │ name             │       │ role             │
│ created_at   │       │ description      │       │ content          │
└──────────────┘       │ code             │       │ created_at       │
                       │ status           │       └──────────────────┘
                       │ deployment_url   │
                       │ created_at       │       ┌──────────────────┐
                       │ updated_at       │       │   deployments    │
                       └──────────────────┘       ├──────────────────┤
                                                  │ id            PK │
                                                  │ project_id    FK │
                                                  │ status           │
                                                  │ url              │
                                                  │ logs             │
                                                  │ created_at       │
                                                  └──────────────────┘
```

## API Endpoints

### Health Check
```
GET /
Response: { "status": "ok", "service": "hatch-api" }
```

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project by ID |
| PATCH | `/api/projects/:id` | Update project |

### Chat (AI Code Generation)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message, receive SSE stream |
| GET | `/api/chat/:projectId` | Get chat history |

### Deployments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deploy` | Start deployment |
| GET | `/api/deploy/:id` | Get deployment status |

### Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/discovery` | List all launched apps |
| GET | `/api/discovery/:id` | Get app details |

### Skills Marketplace

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skillsmp` | List all skills (agents, commands, skills) |
| GET | `/api/skillsmp/:id` | Get skill by ID |
| GET | `/api/skillsmp/category/:category` | List skills by category |
| POST | `/api/skillsmp/:id/install` | Get skill installation instructions |

## Project Status Flow

```
    ┌───────────┐
    │   draft   │  Initial state when project is created
    └─────┬─────┘
          │
          │ POST /api/deploy
          ▼
    ┌───────────┐
    │ deployed  │  Code is live on Cloudflare Workers
    └───────────┘
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Turso database URL |
| `DATABASE_AUTH_TOKEN` | Turso auth token |
| `CLAUDE_API_KEY` | Anthropic API key for Claude |
| `CF_API_TOKEN` | Cloudflare API token |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `ENVIRONMENT` | Environment mode (`development` or `production`) |
| `SKILLSMP_API_KEY` | (Optional) Skills marketplace API key |

## Local Development

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials

# Start development server
pnpm dev
# Server runs at http://localhost:8787

# Generate database migrations
pnpm db:generate

# Run migrations
pnpm db:migrate
```

## Tech Stack

```
┌────────────────────────────────────────┐
│           TECH STACK                   │
├────────────────────────────────────────┤
│  Runtime     │  Cloudflare Workers     │
│  Framework   │  Hono                   │
│  Validation  │  Zod                    │
│  ORM         │  Drizzle                │
│  Database    │  Turso (SQLite)         │
│  AI          │  Claude (Anthropic)     │
│  Language    │  TypeScript             │
└────────────────────────────────────────┘
```

## File Structure

```
services/api/
├── package.json          # Dependencies and scripts
├── wrangler.toml         # Cloudflare Workers config
├── tsconfig.json         # TypeScript config
├── drizzle.config.ts     # Database migration config
├── .dev.vars.example     # Example env vars
└── src/
    ├── index.ts          # Main entry point
    ├── db/
    │   ├── schema.ts     # Database schema definitions
    │   └── client.ts     # Database client factory
    └── routes/
        ├── projects.ts   # Project CRUD operations
        ├── chat.ts       # AI chat with streaming
        ├── deploy.ts     # Deployment management
        ├── discovery.ts  # Browse launched apps
        └── skillsmp.ts   # Skills marketplace proxy (skillsmp.com, aitmpl.com)
```
