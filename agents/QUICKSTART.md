# vibed.fun - Quick Start Guide

## Overview

This project is broken into **8 parallelizable modules** that can be built by multiple agents simultaneously.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           vibed.fun MVP                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   DAY 1 (Start Immediately - In Parallel)                               │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│   │   Agent 1   │  │   Agent 2   │  │   Agent 3   │                     │
│   │ Foundation  │  │  Contracts  │  │ Backend API │                     │
│   │  (2-3 hrs)  │  │  (4-6 hrs)  │  │  (3-4 hrs)  │                     │
│   └──────┬──────┘  └─────────────┘  └─────────────┘                     │
│          │                                                               │
│          ▼                                                               │
│   ┌─────────────┐                                                        │
│   │   Agent 4   │  (Start after Agent 1 completes)                      │
│   │ UI Library  │                                                        │
│   │  (3-4 hrs)  │                                                        │
│   └─────────────┘                                                        │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   DAY 2 (After Foundation + UI Library Complete)                        │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │   Agent 5   │  │   Agent 6   │  │   Agent 7   │  │   Agent 8   │   │
│   │    Chat     │  │   Preview   │  │  Web3 Auth  │  │ Token Panel │   │
│   │  (4-5 hrs)  │  │  (5-6 hrs)  │  │  (2-3 hrs)  │  │  (3-4 hrs)  │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   DAY 3 (Integration)                                                    │
│   - Wire everything together                                             │
│   - End-to-end testing on Base Sepolia                                  │
│   - Polish and deploy                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Task Files

Each agent has a detailed task file in `.context/agent-tasks/`:

| Agent | File | Description | Can Start |
|-------|------|-------------|-----------|
| 1 | `AGENT_1_FOUNDATION.md` | Monorepo, React app, TailwindCSS | Immediately |
| 2 | `AGENT_2_SMART_CONTRACTS.md` | Bonding curve on Base | Immediately |
| 3 | `AGENT_3_BACKEND_API.md` | Hono API, database, Claude | Immediately |
| 4 | `AGENT_4_UI_COMPONENTS.md` | Degen design system | After Agent 1 |
| 5 | `AGENT_5_CHAT_INTERFACE.md` | Chat with AI, markdown | After Agent 1+4 |
| 6 | `AGENT_6_LIVE_PREVIEW.md` | esbuild, iframe preview | After Agent 1 |
| 7 | `AGENT_7_WEB3_AUTH.md` | Privy auth, wallets | After Agent 1+4 |
| 8 | `AGENT_8_TOKEN_LAUNCH_UI.md` | Token form, launch, stats | After Agent 4+7 |

---

## How to Assign Agents

### Day 1 Morning - Fire Off Immediately

**Agent 1: Foundation** (CRITICAL - others depend on this)
```
Read .context/agent-tasks/AGENT_1_FOUNDATION.md and implement it.
Set up the Turborepo monorepo with React/Vite web app and TailwindCSS degen theme.
```

**Agent 2: Smart Contracts** (Independent)
```
Read .context/agent-tasks/AGENT_2_SMART_CONTRACTS.md and implement it.
Research Clanker SDK or build custom bonding curve. Deploy to Base Sepolia.
```

**Agent 3: Backend API** (Independent)
```
Read .context/agent-tasks/AGENT_3_BACKEND_API.md and implement it.
Build Hono API with database schema and Claude integration.
```

### Day 1 Afternoon - After Foundation Completes

**Agent 4: UI Components**
```
Read .context/agent-tasks/AGENT_4_UI_COMPONENTS.md and implement it.
Build the packages/ui design system with degen styling.
```

### Day 2 - All In Parallel

**Agent 5: Chat Interface**
```
Read .context/agent-tasks/AGENT_5_CHAT_INTERFACE.md and implement it.
Build chat UI with streaming, markdown, and code blocks.
```

**Agent 6: Live Preview**
```
Read .context/agent-tasks/AGENT_6_LIVE_PREVIEW.md and implement it.
Build esbuild-wasm bundler and iframe preview system.
```

**Agent 7: Web3 Auth**
```
Read .context/agent-tasks/AGENT_7_WEB3_AUTH.md and implement it.
Integrate Privy for wallet/social login.
```

**Agent 8: Token Launch UI**
```
Read .context/agent-tasks/AGENT_8_TOKEN_LAUNCH_UI.md and implement it.
Build token form, deploy button, and stats panel.
```

---

## Environment Variables Needed

Create `.env` files with:

```bash
# apps/web/.env
VITE_API_URL=http://localhost:8787
VITE_PRIVY_APP_ID=your-privy-app-id
VITE_BONDING_CURVE_ADDRESS=0x...

# services/api/.env
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=your-turso-token
CLAUDE_API_KEY=sk-ant-...
CF_API_TOKEN=your-cf-token
CF_ACCOUNT_ID=your-cf-account

# packages/contracts/.env
PRIVATE_KEY=your-deployer-key
BASESCAN_API_KEY=your-basescan-key
```

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm |
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS + Framer Motion |
| State | Zustand + React Query |
| Auth | Privy (social + wallet) |
| Web3 | wagmi + viem |
| Backend | Hono on Cloudflare Workers |
| Database | Turso (SQLite) or Supabase |
| AI | Claude API (Anthropic) |
| Contracts | Solidity on Base |
| Hosting | Cloudflare Workers/Pages |

---

## After All Modules Complete

### Integration Checklist

1. **Connect frontend to backend**
   - Chat component calls `/api/chat`
   - Projects saved/loaded via `/api/projects`
   - Deploy triggers `/api/deploy`

2. **Wire up Web3**
   - Auth provider wraps entire app
   - Token launch calls bonding curve contract
   - Stats fetched from contract reads

3. **Connect Preview to Chat**
   - Code from AI response → Preview bundler
   - Hot reload on new code generation

4. **Build Discovery Page**
   - Fetch from `/api/discovery`
   - Display app cards with token stats

5. **End-to-End Test**
   - Sign in → Create project → Chat → Preview → Deploy → Launch token
   - Test on Base Sepolia with test ETH

---

## Quick Commands

```bash
# Install dependencies (from root)
pnpm install

# Start development
pnpm dev              # All apps
pnpm dev:web          # Just frontend
pnpm dev:api          # Just backend

# Deploy contracts
cd packages/contracts
pnpm hardhat deploy --network baseSepolia

# Build for production
pnpm build
```

---

## Definition of Done (MVP)

- [ ] User can sign in with Google/Twitter
- [ ] User can create a new project
- [ ] User can chat with AI to generate app code
- [ ] Generated code renders in live preview
- [ ] User can deploy app to Cloudflare Workers
- [ ] User can fill out token details
- [ ] User can launch token on bonding curve
- [ ] Token stats display after launch
- [ ] Discovery page shows all launched apps
- [ ] Full flow works on Base Sepolia testnet

---

## Support

See the detailed implementation roadmap at:
`.context/IMPLEMENTATION_ROADMAP.md`

Individual task files contain all code snippets and step-by-step instructions.
