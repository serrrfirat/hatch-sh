# Phase 0-3 Implementation Tracker (OSS-First)

## Phase 0: Quality Lockdown

### Stream A: Test Infrastructure
- [x] P0-A1: Create shared test fixtures and factories
- [x] P0-A2: Create Playwright page objects + shared test-base
- [x] P0-A3: Expand Idea Maze E2E (canvas container, retry button, sidebar)
- [x] P0-A4: Expand Design Webview E2E (container, nav arrows, tab switching)
- [x] P0-A5: Expand Agent Streaming tests (interleaved events, malformed JSON)
- [x] P0-A6: Expand Repository/Shipping tests (removeWorkspace, agent selection)
- [x] P0-A7: Expand Fault Paths tests (status recovery, clone failure)

### Stream B: Error Boundaries
- [x] P0-B1: Create reusable ErrorBoundary component
- [x] P0-B2: Wrap all page sections with ErrorBoundary

### Stream C: Dev Database Fix
- [x] P0-C1: Replace in-memory mock DB with local SQLite

### Stream D: Token/Blockchain Removal
- [x] P0-D1: Remove all token/blockchain code

### Stream E: CI Stabilization
- [x] P0-E1: Fix CI workflow issues (review-head-sha-gate self-dependency)

---

## Phase 0 Verification
- [x] `pnpm test` — 17 tests pass (5 files, 0 failures)
- [x] `pnpm --filter desktop build` — builds successfully
- [x] `grep -r "tokenLaunch|walletAddress" services/` — 0 matches
- [x] ErrorBoundary wraps all 5 page sections + top-level app
- [x] CI workflow has no circular dependencies

---

## Phase 1: Core Loop (Idea to Build to Ship)
*COMPLETE — 52 new tests, 69 total passing*

### Stream F: GitHub OAuth Fix
- [x] P1-F1: Fix device code polling bug (7 tests)
  - Fixed `github_poll_for_token` to accept `device_code` param
  - Removed duplicate device flow request in `github.rs`
  - Updated bridge.ts and repositoryStore.ts
- [ ] P1-F2: Register real GitHub OAuth App (config task, no tests)
- [x] P1-F3: Token validation + auth status (validateToken added)

### Stream G: Real Deployment (Cloudflare Pages)
- [x] P1-G1: Implement Cloudflare Pages deployment (7 tests)
  - Created `CloudflareService` class
  - Route tests for deploy endpoints
- [x] P1-G2: Deployment status streaming + UI (7 tests)
  - SSE stream tests
  - Desktop UI hook/component tests

### Stream H: Idea Maze → Build Handoff
- [x] P1-H1: Create `buildFromPlan` function (6 tests)
  - `formatPlanAsMarkdown()` in planExporter.ts
  - `buildFromPlan()` action in ideaMazeStore
- [x] P1-H2: Plan reference card in Build sidebar (2 tests)
  - `sourcePlan` + `sourcePlanId` on Workspace type
  - PlanReferenceCard component

### Stream I: First-Run Experience
- [x] P1-I1: First-time user detection (3 tests)
  - `hasCompletedOnboarding` + `setOnboardingComplete` in settingsStore
- [x] P1-I2: Onboarding wizard UI (5 tests)
  - OnboardingWizard component (4-step wizard)
  - Conditional render in Layout.tsx
- [x] P1-I3: Sample project template (3 tests)
  - Template registry + landing-page template

### Stream J: Code Extraction Fix
- [x] P1-J1: Multi-block code extraction (9 tests)
  - `extractCodeBlocks()` in codeExtractor.ts
  - Integrated into chat.ts (replaces single match)

### Phase 1 Verification
- [x] `pnpm test` — 69 tests pass (13 files)
- [x] `tsc --noEmit` (desktop) — 0 errors
- [x] `tsc --noEmit` (API) — 0 errors

### Stream K: API Keys Settings (OS Keychain)
- [x] P1-K1: Rust keychain module — set/get/delete/has via `keyring` crate
- [x] P1-K2: TypeScript keychain bridge (`lib/keychain.ts`)
- [x] P1-K3: Settings store — `apiUrl`, `keychainStatus`, `refreshKeychainStatus()`
- [x] P1-K4: "API Keys" tab in Settings UI (SecretField components)
- [x] P1-K5: Credential override middleware in API (`X-Anthropic-Key` etc.)
- [x] P1-K6: Legacy migration (anthropicApiKey → keychain)
- [x] P1-K7: Tests (9 tests — keychain bridge, store, migration)

### Phase 1+K Verification
- [x] `pnpm test` — 78 tests pass (14 files)
- [x] `cargo check` — compiles cleanly
- [x] Rust keychain commands registered in invoke_handler

### Stream L: Multi-Target Deployment (here.now + Railway)
- [x] P1-L1: Shared `DeployService` interface + `DeployTarget` type
- [x] P1-L2: DB schema — `target` column on deployments table + migration
- [x] P1-L3: `HereNowService` (REST) + `RailwayService` (GraphQL)
- [x] P1-L4: `CloudflareService` implements `DeployService` interface
- [x] P1-L5: Deploy route — target dispatch via `createDeployService()` factory
- [x] P1-L6: API middleware — `X-HereNow-API-Token` / `X-Railway-API-Token` headers
- [x] P1-L7: Keychain + Settings UI — new token fields for here.now and Railway
- [x] P1-L8: `useDeploy` hook — accepts `target` param
- [x] P1-L9: `DeploymentStatus` — dynamic target labels
- [x] P1-L10: `DeployTargetSelector` dropdown component
- [x] P1-L11: Tests (15 new — herenow.test.ts + railway.test.ts)
- [ ] **P1-L12: Wire deploy UI into chat view** — connect `useDeploy`, `DeployTargetSelector`, and `DeploymentStatus` into the actual app so users can trigger deploys from the UI. Currently these are standalone components with no parent consuming them.

### Phase 1+L Verification
- [x] `pnpm test` — 94 tests pass (16 files)
- [x] `tsc --noEmit` (desktop + API) — 0 errors

---

## Phase 2: Reliability & Trust
*Deferred*

## Phase 3: Worth Using (OSS)
*Billing/Stripe removed. Auth, templates, agent UX only.*
*Deferred*
