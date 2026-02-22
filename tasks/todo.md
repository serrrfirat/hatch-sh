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
*Ready to start*

## Phase 2: Reliability & Trust
*Deferred*

## Phase 3: Worth Using (OSS)
*Billing/Stripe removed. Auth, templates, agent UX only.*
*Deferred*
