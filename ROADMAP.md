# Hatch.sh Roadmap: From Here to Real Users

> **Goal:** Get Hatch.sh to a state where people actually use it, pay for it, and tell others about it.
>
> **Target persona:** Indie hackers and solo founders who want to ship MVPs fast using AI.
>
> **North star metric:** Weekly active users who complete at least one Build session.

---

## Current State (February 2026)

### What Actually Works
- **Claude Code Bridge** — Real CLI invocation with streaming, tool tracking, extended thinking
- **Cloud Chat** — Real Claude API streaming via SSE (Sonnet 4)
- **Live Preview** — esbuild bundler + iframe rendering of React components
- **Git Operations** — Clone, commit, push, PR creation via real Git CLI + GitHub API
- **Skills Installation** — Real filesystem read/write to `.claude/skills/`
- **Idea Maze AI** — Claude Code integration for brainstorming, critique, connection-finding
- **Skills Marketplace** — 60k+ skills aggregated from aitmpl.com, SkillsMP, GitHub

### What's Broken or Stubbed
- **GitHub OAuth** — Device flow code exists but has placeholder client ID
- **Deployment** — Faked with `setTimeout(3000)`. No real infrastructure.
- **Authentication** — `userId` hardcoded to `'temp-user'`. No user identity.
- **Token/Blockchain** — Database placeholder. Purpose unclear. Deprioritize.
- **Database in dev** — In-memory mock with fragile JSON parsing. Dev/prod diverge.

### What's Missing Entirely
- Real deployment pipeline
- User accounts and auth
- Cross-device sync
- Collaboration
- Undo/history in Idea Maze
- Project templates
- Error boundaries / crash resilience
- Analytics / telemetry

---

## Phase 0: Finish the Quality Lockdown (Current)
**Timeline: 2-3 weeks | Status: In progress**

The existing quality lockdown is the right call. Ship nothing new until the foundation is solid.

### Must complete before moving on:
- [ ] All 5 critical desktop flow suites have E2E coverage (Suites A-E)
- [ ] CI is consistently green on every PR
- [ ] Flake rate < 2% on critical test suite
- [ ] Fix React error boundaries — a crash in Idea Maze canvas shouldn't kill the app
- [ ] Fix the dev database — replace the in-memory mock with a local SQLite file so dev/prod behavior matches

### Exit criteria:
> A developer can clone the repo, run `pnpm dev`, and exercise every critical flow without hitting a crash or silent failure.

---

## Phase 1: Make the Core Loop Work End-to-End
**Timeline: 4-6 weeks**

**The promise is:** Idea → Design → Build → Ship. Right now "Ship" is fake. Fix that.

### 1.1 GitHub OAuth (Fix the Stub)
- [ ] Register a real GitHub OAuth App and configure the client ID
- [ ] Test the full device flow: user sees code → authorizes → token saved
- [ ] Handle token refresh and expiry gracefully
- [ ] Show clear auth status in the UI (connected / disconnected / expired)

### 1.2 Real Deployment
Pick ONE deployment target and make it work perfectly. Recommendation: **Cloudflare Workers** (already in the stack) or **Vercel** (most familiar to target users).

- [ ] Replace the `setTimeout` stub with real deployment
- [ ] Support static sites (HTML/CSS/JS) and simple React apps as the first tier
- [ ] Generate a real public URL: `{project-slug}.hatch.sh` or similar
- [ ] Show deployment status with real-time logs (building → deploying → live → failed)
- [ ] Add a "View Live" button that opens the deployed URL
- [ ] Handle deployment failures with actionable error messages

### 1.3 Idea Maze → Build Handoff (Polish)
The "Build This Plan" flow exists but needs tightening:
- [ ] Structured plan output (requirements list, tech constraints, acceptance criteria) — not just free text
- [ ] Plan automatically becomes the system prompt context for the new workspace
- [ ] AI references the plan throughout the conversation, not just the first message
- [ ] Show the plan as a pinned card in the Build tab sidebar for reference

### 1.4 First-Run Experience
- [ ] Onboarding wizard: Welcome → Connect GitHub → Clone or create repo → First workspace
- [ ] Skip option for users who want to explore without GitHub
- [ ] Sample project template ("Build a landing page") that showcases the full loop
- [ ] Tooltips on key UI elements for first-time users (dismiss after first use)

### Exit criteria:
> A new user can download Hatch, connect GitHub, describe an app in Idea Maze, click "Build This," watch the AI generate it, click "Deploy," and visit a live URL. Under 10 minutes.

---

## Phase 2: Make It Reliable Enough to Trust
**Timeline: 4-6 weeks (overlaps with Phase 1 backend work)**

Users won't come back if the tool feels brittle. This phase is about trust.

### 2.1 Error Handling & Resilience
- [ ] React error boundaries on every major section (Idea Maze, Build, Design, Marketplace)
- [ ] Agent stream interruption recovery — reconnect and resume, don't lose context
- [ ] Graceful handling of malformed JSON from agent streams
- [ ] Git operation failures show actionable messages ("Push failed: you need to pull first")
- [ ] Expired GitHub auth triggers re-auth flow, not a cryptic error

### 2.2 Context Management for AI
- [ ] Sliding window for chat history — don't send 100+ messages to Claude every turn
- [ ] Summarize older conversation context automatically
- [ ] Project-level memory file (`.hatch/context.md`) that persists decisions across sessions
- [ ] Cost visibility — show token usage per message and cumulative per workspace

### 2.3 Multi-File Project Support
The code extraction regex (`/```tsx?\n([\s\S]*?)```/`) only grabs one code block. Real projects need:
- [ ] Parse multi-file outputs from Claude (detect file paths in code fence headers)
- [ ] Write extracted files to the actual project directory, not just a `code` column
- [ ] Show file tree reflecting real project structure in the Build tab
- [ ] Live Preview serves the whole project, not just one component

### 2.4 Undo/History for Idea Maze
- [ ] Command pattern for undo/redo (Cmd+Z / Cmd+Shift+Z)
- [ ] Snapshot history with ability to restore previous states
- [ ] Auto-save indicator (saved / saving / unsaved changes)

### Exit criteria:
> A user can have a 30-minute Build session without hitting an unrecoverable error. If something goes wrong, the app tells them what happened and how to fix it.

---

## Phase 3: Make It Worth Paying For
**Timeline: 6-8 weeks**

Free tools get tried. Paid tools get used. This phase adds the value that justifies a subscription.

### 3.1 User Accounts & Auth
- [ ] Sign up / sign in with GitHub (OAuth already partially built)
- [ ] User profile with API key management
- [ ] Workspace data synced to cloud (Turso) for cross-device access
- [ ] Usage tracking per user (AI credits, deployments, storage)

### 3.2 Project Templates
Reduce blank-page anxiety:
- [ ] "Start with Next.js" / "Start with React + Vite" / "Start with Landing Page"
- [ ] Templates include pre-configured project structure, dependencies, and initial prompt context
- [ ] Community-contributed templates (later — start with 5-10 curated ones)
- [ ] "Remix" — fork someone else's deployed project as a starting point

### 3.3 Enhanced Agent Experience
- [ ] Model selection per task type (Haiku for quick questions, Sonnet for code, Opus for architecture)
- [ ] Agent activity timeline — visual panel showing what the agent is reading/writing/running
- [ ] "Checkpoint" system — save agent state and roll back if a direction isn't working
- [ ] Automated test running — after AI writes code, run existing tests and feed failures back
- [ ] Token/cost tracking dashboard with per-workspace breakdown

### 3.4 Keyboard-First Power User Experience
- [ ] Cmd+K command palette (switch workspace, open file, run command, deploy)
- [ ] Cmd+P fuzzy file finder
- [ ] Cmd+1/2/3 quick workspace switching (partially exists)
- [ ] Vim-style keyboard navigation option
- [ ] Customizable keybindings

### 3.5 Pricing & Billing
- [ ] Free tier: Local agent mode (BYOA) with up to 3 deployments/month
- [ ] Pro tier ($29/mo): Cloud AI credits, unlimited deployments, priority support
- [ ] Stripe integration for subscriptions
- [ ] Usage metering and billing dashboard

### Exit criteria:
> 100 users are actively using Hatch weekly. At least 10 are paying. NPS > 40.

---

## Phase 4: Make It Social
**Timeline: 6-8 weeks**

Network effects turn a tool into a platform.

### 4.1 Share & Discover
- [ ] Public project gallery — browse what others have built with Hatch
- [ ] "Built with Hatch" badge for deployed sites
- [ ] Share workspace link — others can view (read-only) your build session
- [ ] One-click "Remix" from gallery to fork and customize

### 4.2 Skills Marketplace V2
- [ ] Skill ratings and reviews
- [ ] "Install count" tracking
- [ ] Featured/trending skills curated weekly
- [ ] Skill creation wizard — help users package their own skills
- [ ] Premium skills with revenue sharing (70/30 creator/Hatch)

### 4.3 Collaboration (V1)
- [ ] Invite a collaborator to a workspace
- [ ] Shared chat — both users can direct the AI agent
- [ ] Real-time presence (see who's looking at what)
- [ ] Comment on specific code lines in diff view

### 4.4 Community & Content
- [ ] Discord/community server for Hatch users
- [ ] Weekly "Build in Public" showcase
- [ ] Template marketplace where users share project starters
- [ ] Blog/changelog with build tutorials ("Build a SaaS landing page in 5 minutes")

### Exit criteria:
> 1,000 weekly active users. Organic growth via sharing and gallery. Skills marketplace has creator contributions.

---

## Phase 5: Make It Enterprise-Ready
**Timeline: 8-12 weeks (start only after Phase 4 metrics are hit)**

This phase is about expanding from indie hackers to teams and companies.

### 5.1 Team Workspaces
- [ ] Organization accounts with team management
- [ ] Shared repositories and workspaces across team members
- [ ] Role-based access (admin, builder, viewer)
- [ ] Team billing with seat-based pricing

### 5.2 Security & Compliance
- [ ] SOC 2 readiness audit
- [ ] Self-hosted option for enterprise (Hatch as a Docker container)
- [ ] Audit logs for all agent actions
- [ ] Data residency controls
- [ ] SSO (SAML/OIDC) integration

### 5.3 Advanced Deployment
- [ ] Multi-environment support (staging → production)
- [ ] Custom domains for deployed projects
- [ ] Rollback to previous deployments
- [ ] Environment variables / secrets management
- [ ] Deploy to AWS/GCP/Azure (not just Cloudflare)

### 5.4 Analytics & Observability
- [ ] Project analytics (visitors, performance, errors on deployed sites)
- [ ] Agent performance metrics (success rate, cost efficiency)
- [ ] Build session recordings for debugging and training

### Exit criteria:
> First enterprise customer paying $500+/mo. Team features actively used by 3+ teams.

---

## What to Deprioritize

These exist in the codebase but should NOT be worked on until Phase 3+:

| Feature | Why Deprioritize |
|---------|-----------------|
| **Token/Blockchain** (`tokenLaunches` table, `/api/tokens`) | Distracts from core value prop. Remove from UI. Revisit only if there's clear market signal. |
| **Discovery page** (`/api/discovery`) | No value without real deployments and real users. Enable after Phase 3. |
| **Wallet integration** (`walletAddress` in users table) | Web3 integration adds complexity without solving user problems right now. |
| **OpenCode/Cursor adapters** | Claude Code is the primary agent. Polish that experience first. Add others in Phase 3 when the adapter interface is battle-tested. |

---

## Technical Debt to Address Along the Way

These should be fixed opportunistically as you touch nearby code, not as dedicated sprints:

- [ ] Add database indexes on `projectId`, `userId`, `walletAddress`
- [ ] Replace skills marketplace scraping with proper API partnerships or self-hosted index
- [ ] Migrate from in-memory mock DB to local SQLite for development
- [ ] Add structured logging (not just `console.log`)
- [ ] Set up error tracking (Sentry or similar)
- [ ] Add telemetry for product analytics (PostHog or similar — opt-in, privacy-respecting)
- [ ] Remove dead token/blockchain code from API routes
- [ ] Add rate limiting on API endpoints
- [ ] Add request authentication middleware (currently no auth on any endpoint)

---

## Key Metrics to Track

| Phase | Primary Metric | Target |
|-------|---------------|--------|
| 0 | CI pass rate | 100% on critical flows |
| 1 | End-to-end completion rate (Idea → Deploy) | > 60% of attempts |
| 2 | Session length without error | > 30 minutes |
| 3 | Weekly active users / Paying users | 100 WAU / 10 paying |
| 4 | Organic sign-ups (no paid acquisition) | 50/week |
| 5 | Enterprise pipeline | 3+ qualified leads |

---

## Release Strategy

| Milestone | Release Type | Audience |
|-----------|-------------|----------|
| Phase 0 complete | Internal dogfood | Team only |
| Phase 1 complete | **Closed alpha** | 20-30 hand-picked indie hackers |
| Phase 2 complete | **Open beta** | Anyone with a waitlist signup |
| Phase 3 complete | **Public launch** | Product Hunt, Hacker News, Twitter |
| Phase 4 complete | **Growth mode** | Content marketing, partnerships, community |
| Phase 5 complete | **Enterprise GA** | Sales-led outbound |

---

## Decision Log

Decisions made while creating this roadmap:

1. **Target indie hackers first, not enterprises.** They're faster to acquire, more forgiving, and more vocal. Enterprise comes in Phase 5.
2. **One deployment target, not many.** Cloudflare or Vercel — pick one and make it flawless. Multi-cloud is Phase 5.
3. **Claude Code is the primary agent.** Don't spread effort across Cursor/OpenCode adapters until the core experience is polished.
4. **Deprioritize blockchain/tokens.** It adds complexity without solving the core user problem. Can revisit if market demands it.
5. **Local-first is an advantage.** Don't force cloud accounts early. Let users try the product with their own Claude Code subscription before asking them to pay.
6. **Quality lockdown is correct.** The instinct to stop features and fix reliability before shipping is the right call. Maintain this discipline.

---

*Last updated: 2026-02-22*
