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

_COMPLETE — 52 new tests, 69 total passing_

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

_Priority order: A → C → B → D | Cost/token visibility deferred to Phase 3_

### Stream A: Error Handling & Resilience

#### P2-A1: Agent stream interruption recovery

[x] Detect stream disconnection (process crash, network drop, EventSource close)
[x] Implement retry logic with exponential backoff for cloud API streams
[x] For local agents: detect process exit mid-stream, surface error + offer "Retry"
[x] Preserve partial response on interruption (don't lose what was already streamed)
[x] Tests: stream interruption scenarios (3+ tests)
Files: `useChat.ts`, `claudeCode.ts`, `opencode.ts`, `cursor.ts`, `lib.rs`

#### P2-A2: Malformed JSON handling

[x] Add JSON validation layer before parsing in all adapters
[x] Emit structured error events instead of silently skipping bad lines
[x] Log malformed lines for debugging (not user-facing)
[x] Handle partial JSON at stream boundaries (buffered line reassembly)
[x] Tests: malformed JSON edge cases (3+ tests)
Files: `claudeCode.ts`, `opencode.ts`, `cursor.ts`, `chat.ts` (cloud SSE)

#### P2-A3: Actionable Git operation failure messages

[x] Map common Git errors to user-friendly messages:

- Push rejected → "Pull first, then push again"
- Auth failure → "GitHub token expired — reconnect in Settings"
- Merge conflict → "Conflict in {files} — resolve before committing"
- Clone failure → "Repository not found or no access"
  [x] Surface messages in toast/notification UI (not console)
  [x] Tests: error mapping (4+ tests)
  Files: `bridge.ts` (git), `repositoryStore.ts`, `github.rs`

#### P2-A4: Expired GitHub auth → re-auth flow

[x] Add token expiration detection (check 401 on GitHub API calls)
[x] On expired token: show banner/modal prompting re-auth
[x] Re-auth flow reuses existing device code flow (don't require full re-login)
[x] After re-auth: retry the failed operation automatically
[x] Tests: expiration detection + re-auth trigger (3+ tests)
Files: `bridge.ts` (github), `github.rs`, `repositoryStore.ts`, `settingsStore.ts`

---

### Stream C: Multi-File Project Support

#### P2-C1: Write extracted files to workspace filesystem

[x] After `extractCodeBlocks()`, write each `CodeBlock` to workspace project directory
[x] Use Tauri FS API (or Rust command) to write files with proper directory creation
[x] Handle file overwrites with confirmation or auto-overwrite on AI regeneration
[ ] Update `projects.code` column to store file manifest (paths) not full content
[x] Tests: file writing, directory creation, overwrite handling (4+ tests)
Files: `chat.ts` (API route), new `fileWriter.ts` utility, Rust FS commands

#### P2-C2: File tree component in Build tab

[x] Create `FileTree` component that reads workspace filesystem
[x] Show real directory structure with expand/collapse
[x] Click file → open in editor tab
[ ] Visual indicators for AI-generated vs user-edited files
[ ] Auto-refresh on file changes (watch or poll)
[ ] Tests: component rendering, interaction (3+ tests)
Files: new `components/build/FileTree.tsx`, `IDEPage.tsx`

#### P2-C3: Multi-file bundler for Live Preview

[x] Update esbuild virtual FS plugin to accept file map (multiple files)
[ ] Entry point detection: `index.tsx` > `App.tsx` > `main.tsx` > first file
[x] Resolve cross-file imports within the virtual filesystem
[x] Handle CSS/style imports across files
[ ] Fallback: if bundling fails, show the main component only (current behavior)
[ ] Tests: multi-file bundling, import resolution, entry detection (4+ tests)
Files: `lib/bundler/index.ts`, `usePreview.ts`, `PreviewPanel.tsx`

---

### Stream B: Context Management

#### P2-B1: Sliding window for chat history

[x] Implement configurable window size (default: last 20 messages sent to API)
[x] Keep system prompt + plan context always included (not part of window)
[x] Oldest messages outside window excluded from API call, kept in UI
[ ] Show visual indicator when context is truncated ("Showing last N messages")
[x] Tests: windowing logic, system prompt preservation (3+ tests)
Files: `useChat.ts`, `chatStore.ts`

#### P2-B2: Auto-summarize older conversation context

[x] When window shifts, summarize excluded messages into a context block
[ ] Summary injected as system-level context ("Previous conversation summary: ...")
[ ] Use lightweight model call (Haiku) for summarization
[x] Cache summaries per conversation to avoid re-summarizing
[x] Tests: summarization trigger, injection, caching (3+ tests)
Files: `useChat.ts`, new `lib/contextSummarizer.ts`, `chatStore.ts`

#### P2-B3: Project-level memory file (.hatch/context.md)

[x] Create `.hatch/context.md` in workspace root on first AI decision
[x] Auto-append key decisions (tech choices, architecture, constraints)
[x] Inject file contents into system prompt for every message
[x] User can manually edit the file to correct/add context
[ ] Tests: file creation, decision extraction, injection (3+ tests)
Files: new `lib/projectMemory.ts`, `useChat.ts`, Tauri FS commands

---

### Stream D: Idea Maze Undo/History

#### P2-D1: Undo/redo with Cmd+Z / Cmd+Shift+Z

[x] Add `zundo` (zustand temporal middleware) or custom history middleware
[x] Track mutation history for node/connection operations (not viewport/UI state)
[x] Register Cmd+Z and Cmd+Shift+Z keyboard shortcuts on IdeaMazePage
[x] Cap history stack (50-100 entries, in-memory only, clears on restart)
[x] Tests: undo/redo actions, history cap, keyboard shortcuts (4+ tests)
Files: `ideaMazeStore.ts`, `IdeaMazePage.tsx`, new `useUndoRedo.ts` hook

#### P2-D2: Snapshot history with restore

[x] Named snapshots: user can save current state as "Snapshot: {name}"
[x] Snapshot list panel in sidebar (name, timestamp, node count)
[x] Restore from snapshot replaces current moodboard state
[x] Snapshots stored to filesystem alongside moodboard files
[x] Tests: save/list/restore snapshots (3+ tests)
Files: `ideaMazeStore.ts`, `storage.ts`, new `components/ideaMaze/SnapshotPanel.tsx`

#### P2-D3: Auto-save indicator

[x] Show save status in Idea Maze toolbar: Saved ✓ / Saving... / Unsaved changes
[x] Track `lastSavedAt` timestamp in store
[x] Visual transition between states (subtle, non-distracting)
[x] Tests: indicator state transitions (2+ tests)
Files: `ideaMazeStore.ts`, `storage.ts`, `VerticalToolbar.tsx` or new status component

---

### Phase 2 Exit Criteria

[ ] 30-minute Build session without unrecoverable error
[ ] Stream interruption recovers gracefully (retry or partial save)
[ ] Multi-file project renders correctly in Live Preview
[ ] Chat context stays manageable after 50+ messages
[ ] Idea Maze supports undo/redo for all node/connection operations

## Phase 3: Worth Using (OSS)

_Billing/Stripe removed. Auth, templates, agent UX only._
_Deferred_
