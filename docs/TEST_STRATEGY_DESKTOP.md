# Desktop Test Strategy (Tauri) — Hatch

## Scope
Desktop app quality gates for Hatch across:
- Idea Maze (mind mapping + AI interview/planning)
- Design mode embedded webview
- BYOA agent harnesses (local + cloud)
- Workspace/git/PR shipping flows

## TDD Policy (Non-Negotiable)
For this project, all agent and human implementation follows TDD:
1. Write a failing test for the intended behavior.
2. Implement the smallest change to pass.
3. Refactor while keeping tests green.
4. Commit with tests.

Any task without a test delta is incomplete unless explicitly marked docs/chore-only.

## Test Architecture

### 1) PR Gate (required)
- Lint + typecheck (TS + Rust where applicable)
- Unit tests (frontend + Rust logic)
- Contract tests:
  - Tauri bridge contracts (git/github/skills)
  - Agent stream event contracts (`text`, `thinking`, `tool_use`, `tool_result`, `done`)
  - Repository/workspace lifecycle contracts
- Targeted E2E smoke for critical desktop journeys

### 2) Nightly Gate
- macOS + Windows package/build smoke
- Launch sanity for packaged desktop app
- Startup and memory budget checks
- Flake detector (rerun failures up to 3x)

### 3) Release Gate
- Critical E2E suite green for 7 consecutive runs
- No open P0/P1 regressions
- Rollback-ready artifacts

## Hatch Critical Journey Suites (v2)

### A. Idea Maze Deep Flow
1. Create/select moodboard
2. Add nodes via keyboard + paste
3. Connect/duplicate/delete nodes
4. Run AI actions: find connections / generate ideas / critique
5. Start interview, answer multi-step questions
6. Parse `plan` output into Plan node
7. Trigger **Build from Plan** and confirm workspace creation + BYOA navigation

### B. Design Webview Lifecycle
1. Open Design tab and create embedded webview
2. Switch tabs and return (reuse cached webview)
3. Resize window and verify webview reposition/resize
4. Validate load error fallback (open external browser)

### C. Agent Harness Flow
1. Per-workspace agent selection (claude-code/opencode/cursor/cloud)
2. Validate unauthenticated-agent UX path
3. Streamed response rendering with tool-use blocks
4. Stop-generation behavior retains partial output and exits loading state
5. Open-PR prompt injection includes correct branch/workspace context

### D. Shipping Flow
1. Clone/open repository
2. Create workspace (worktree)
3. Edit file and persist
4. Refresh git status
5. Commit + push
6. Create PR and persist PR metadata in workspace
7. Merge PR and transition state to merged

## Fault Injection Requirements
Every major subsystem must have failure-path tests:
- Agent/process crash mid-stream
- Malformed structured JSON (Idea Maze AI responses)
- Git push failure or missing upstream branch
- GitHub auth expiry during PR operations
- Design webview creation/load failure

## Coverage Policy
- Prioritize critical-module and critical-journey coverage.
- Every production/QA regression must add:
  1) incident note,
  2) regression test,
  3) CI guardrail.

## Suggested Test Layout
- `testing/contracts/` — bridge + stream + state machine contracts
- `testing/e2e/` — desktop journey flows
- `testing/fixtures/` — reproducible project/repo fixtures

## Stability Exit Criteria
- 14 days with no P0 desktop regression
- <2% flaky tests in critical suite
- ≥95% pass rate on critical journey suite
