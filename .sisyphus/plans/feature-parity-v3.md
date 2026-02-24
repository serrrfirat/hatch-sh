# Phase 3: Feature Parity & Polish

## TL;DR

> **Quick Summary**: Bring Hatch to feature parity with Conductor Build by implementing parallel agent orchestration (the killer feature), 8 high-value parity features (chat search, Checks tab, workspace status, context meter, slash commands, code review, image attachments, file mentions), and critical codebase polish (console.log cleanup + type safety fixes). TDD throughout.
>
> **Deliverables**:
>
> - Parallel multi-agent system with git worktree isolation and dashboard
> - 8 new Conductor-parity features integrated into existing UI
> - 70+ console.log removals and type safety fixes
> - Full test coverage for all new features
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: T1-T2 (polish) -> T12-T13 (git foundation) -> T14-T17 (parallel agents) -> T18 (integration) -> F1-F4 (verification)

---

## Context

### Original Request

User wants to polish existing Hatch features and achieve feature parity with Conductor Build (conductor.build), a YC S24 macOS-only desktop app that orchestrates parallel AI coding agents in isolated git worktrees. After extensive research of Conductor's features (changelog v0.28-v0.36.2, docs, community feedback) and a full Hatch codebase audit, user selected specific features to prioritize.

### Interview Summary

**Key Discussions**:

- Parallel agents: YES, include as the flagship feature (Conductor's killer differentiator)
- 8 parity features selected from 20+ Conductor features
- Polish scope: Critical only (console.logs + type safety, skip component refactoring)
- Test strategy: TDD with Vitest
- Features explicitly excluded: Rich diff viewer upgrade, MCP, keyboard shortcuts, Open in IDE, Linear/GitHub Issues integration, workspace forking, checkpoints, scripts

**Research Findings**:

- Hatch already has git worktree support in repositoryStore.ts and git/bridge.ts
- MentionPopover.tsx exists with partial file mention support (642 lines, 22 console.logs)
- 70+ console.log statements across the codebase need removal
- 7 oversized components (>600 lines) identified but refactoring deferred
- Conductor uses "one workspace = one git worktree = one CLI process" model
- Conductor does NOT have inter-agent communication — agents are autonomous
- Hatch already supports 3 local CLI agents (Claude Code, OpenCode, Cursor) + cloud models

### Metis Review

**Identified Gaps** (addressed):

- Git operation serialization is MANDATORY before parallel agents (concurrent git ops corrupt shared .git/ objects) -> Added GitCoordinator task
- Worktree locking missing (GC could prune active worktrees) -> Added lifecycle manager task
- Worktree repair on startup needed for crash recovery -> Added to lifecycle manager
- API rate limit sharing across concurrent agents -> Added rate limit awareness task
- Max 3 concurrent agents as practical ceiling (RAM/CPU constraints) -> Added as guardrail
- MentionPopover needs validation: does it inject file content or just path text? -> Added to task
- localStorage may struggle with growing parallel workspace message history -> Added as edge case to test
- Workspace status: should be manually set, not computed from git state -> Added as design decision

---

## Work Objectives

### Core Objective

Transform Hatch from a single-agent development tool into a multi-agent orchestration platform that matches Conductor Build's core workflow, while cleaning up technical debt for production readiness.

### Concrete Deliverables

- Parallel agent system: spawn/monitor/kill multiple CLI agents in isolated worktrees
- Multi-agent dashboard: see all active agents, their status, streaming output
- GitCoordinator: serialized git command queue preventing corruption
- Worktree lifecycle: locking, startup repair, crash recovery
- Chat search (Cmd+F): full-text search within chat messages
- Checks tab v2: GitHub Actions logs, re-run failed checks, deployment status
- Workspace status: Backlog/In Progress/In Review/Done states with UI
- Context usage meter: token/context window visualization
- Slash commands: /clear, /review, /restart + extensible parser
- Code review mode: AI reviews diff via chat
- Image attachments: drag-drop images into chat
- File mentions: @ to mention files with autocomplete and content injection
- 70+ console.log removals
- Type safety fixes (as any, non-null assertions, existing LSP errors)

### Definition of Done

- [ ] All 18 implementation tasks pass their QA scenarios
- [ ] `pnpm test` passes with 0 failures
- [ ] `pnpm build:desktop` succeeds
- [ ] ESLint passes with no new warnings
- [ ] No `console.log` statements remain in production code
- [ ] No `as any` or `@ts-ignore` in new code
- [ ] 3 parallel agents can run simultaneously without git corruption

### Must Have

- Git serialization queue before ANY parallel agent work
- Max 3 concurrent agents (enforced in code, not just docs)
- Worktree locking on creation, unlock on removal
- Startup worktree repair for crash recovery
- Rate limit warning when agents approach API ceiling
- Chat search works on workspaces with 500+ messages
- All slash commands work while agent is NOT streaming
- Image attachments work with local CLI agents (base64 or file path)

### Must NOT Have (Guardrails)

- NO inter-agent message bus or coordination protocol (follow Conductor's autonomous model)
- NO custom per-repo slash commands in v1 (built-in only)
- NO inline code review annotations UI (chat-based output only)
- NO multiple visible chat panels (single focused chat, background agents in dashboard)
- NO token-accurate context meter (use message count + rough byte estimate)
- NO component refactoring in this phase (deferred to Phase 4)
- NO constants extraction in this phase
- NO `as any`, `@ts-ignore`, `@ts-expect-error` in new code
- NO new npm dependencies without checking existing ones first
- NO `console.log` in new production code (use proper error handling or remove)
- Slash command `/clear` must be BLOCKED while agent is streaming (race condition)
- Image attachments to cloud models: show warning that cloud models cannot access local images

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** -- ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES (Vitest in package.json, existing tests in hooks/**tests**/)
- **Automated tests**: TDD (tests first, then implement)
- **Framework**: Vitest (bun test compatible, already configured)
- **TDD Workflow**: Each task follows RED (failing test) -> GREEN (minimal impl) -> REFACTOR

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) -- Navigate, interact, assert DOM, screenshot
- **TUI/CLI**: Use interactive_bash (tmux) -- Run command, send keystrokes, validate output
- **API/Backend**: Use Bash (curl) -- Send requests, assert status + response fields
- **Library/Module**: Use Bash (vitest) -- Import, call functions, compare output
- **Rust Backend**: Use Bash (cargo test) -- Run Rust unit tests

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately -- polish + quick UI features):
  T1:  Console.log cleanup (70+ removals across 7 key files) [quick]
  T2:  Type safety fixes (as any, non-null assertions, LSP errors) [quick]
  T3:  Workspace status (add status field + UI indicators) [quick]
  T4:  Chat search (Cmd+F within messages) [quick]
  T5:  Context usage meter component [quick]
  T6:  Slash commands parser + built-in commands [quick]
  T7:  GitCoordinator types + interfaces [quick]

Wave 2 (After Wave 1 -- medium features + git foundation):
  T8:  File mentions @ completion (depends: T1, T2) [unspecified-high]
  T9:  Image attachments in chat (depends: T1, T2) [unspecified-high]
  T10: Code review mode (depends: T6) [unspecified-high]
  T11: Checks tab v2 - GitHub Actions (depends: T1, T2) [deep]
  T12: GitCoordinator implementation (depends: T7) [deep]
  T13: Worktree lifecycle manager (depends: T7, T12) [deep]

Wave 3 (After Wave 2 -- parallel agents core):
  T14: Concurrent agent process manager (depends: T12, T13) [deep]
  T15: Multi-agent dashboard UI (depends: T3, T14) [visual-engineering]
  T16: Rate limit awareness + resource monitoring (depends: T14) [unspecified-high]

Wave 4 (After Wave 3 -- routing + integration):
  T17: Parallel workspace routing (depends: T14, T15) [deep]
  T18: Integration testing - all features (depends: T8-T17) [deep]

Wave FINAL (After ALL -- independent review, 4 parallel):
  F1: Plan compliance audit (oracle)
  F2: Code quality review (unspecified-high)
  F3: Real manual QA (unspecified-high)
  F4: Scope fidelity check (deep)

Critical Path: T7 -> T12 -> T13 -> T14 -> T17 -> T18 -> F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 7 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks        | Wave |
| ---- | ---------- | ------------- | ---- |
| T1   | --         | T8, T9, T11   | 1    |
| T2   | --         | T8, T9, T11   | 1    |
| T3   | --         | T15           | 1    |
| T4   | --         | T18           | 1    |
| T5   | --         | T18           | 1    |
| T6   | --         | T10           | 1    |
| T7   | --         | T12           | 1    |
| T8   | T1, T2     | T18           | 2    |
| T9   | T1, T2     | T18           | 2    |
| T10  | T6         | T18           | 2    |
| T11  | T1, T2     | T18           | 2    |
| T12  | T7         | T13, T14      | 2    |
| T13  | T7, T12    | T14           | 2    |
| T14  | T12, T13   | T15, T16, T17 | 3    |
| T15  | T3, T14    | T17           | 3    |
| T16  | T14        | T18           | 3    |
| T17  | T14, T15   | T18           | 4    |
| T18  | T8-T17     | F1-F4         | 4    |

### Agent Dispatch Summary

- **Wave 1**: 7 tasks -- T1-T7 all `quick`
- **Wave 2**: 6 tasks -- T8-T9 `unspecified-high`, T10 `unspecified-high`, T11 `deep`, T12 `deep`, T13 `deep`
- **Wave 3**: 3 tasks -- T14 `deep`, T15 `visual-engineering`, T16 `unspecified-high`
- **Wave 4**: 2 tasks -- T17 `deep`, T18 `deep`
- **FINAL**: 4 tasks -- F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [x] 1. Console.log Cleanup (70+ removals)

  **What to do**:
  - Search all `.ts` and `.tsx` files under `apps/desktop/src/` for `console.log`, `console.warn`, `console.error`
  - Remove ALL console.log statements from production code (keep only in test files)
  - For `console.error` in catch blocks: evaluate if the error should be silently swallowed or if the catch block needs better handling
  - Key files with highest console.log density:
    - `src/lib/ideaMaze/storage.ts` (25 instances)
    - `src/components/chat/MentionPopover.tsx` (22 instances)
    - `src/lib/claudeCode/bridge.ts` (15 instances)
    - `src/stores/ideaMazeStore.ts` (11 instances)
    - `src/hooks/useIdeaMazeChat.ts` (7 instances)
    - `src/pages/MarketplacePage.tsx` (8 instances)
    - `src/hooks/useChat.ts` (6 instances)
  - Do NOT add a logging service or abstraction -- simply remove the debug logs
  - Run `pnpm lint` after changes to ensure no unused import warnings

  **Must NOT do**:
  - Do NOT remove console statements from test files (`__tests__/`, `.test.ts`)
  - Do NOT introduce a logging library or wrapper
  - Do NOT modify any logic -- only remove/comment console statements
  - Do NOT touch files outside `apps/desktop/src/`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - No special skills needed -- straightforward search-and-remove

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2, T3, T4, T5, T6, T7)
  - **Blocks**: T8, T9, T11 (clean codebase before feature work)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src/lib/ideaMaze/storage.ts:59,61,124,126,158,176` - Highest density file (25 console.logs in storage operations)
  - `apps/desktop/src/components/chat/MentionPopover.tsx:182,185,193,258,302` - Agent/skill loading debug logs (22 instances)
  - `apps/desktop/src/lib/claudeCode/bridge.ts:235,241,245,249,251` - Stream parsing debug logs (15 instances)

  **Acceptance Criteria**:
  - [ ] `grep -r 'console.log' apps/desktop/src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v .test. | grep -v node_modules | wc -l` returns 0
  - [ ] `pnpm lint` passes in apps/desktop
  - [ ] `pnpm build:desktop` succeeds

  **QA Scenarios:**
  ```
  Scenario: All console.log removed from production code
    Tool: Bash
    Steps:
      1. Run: grep -r 'console.log' apps/desktop/src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v '.test.' | grep -v node_modules
      2. Assert: output is empty (0 lines)
      3. Run: grep -r 'console.warn' apps/desktop/src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v '.test.' | grep -v node_modules | wc -l
      4. Record count for reference (some console.warn may be intentional)
    Expected Result: Zero console.log in production code
    Evidence: .sisyphus/evidence/task-1-console-log-grep.txt

  Scenario: Build still succeeds after removals
    Tool: Bash
    Steps:
      1. Run: pnpm lint (in apps/desktop)
      2. Assert: exit code 0
      3. Run: pnpm build:desktop
      4. Assert: exit code 0
    Expected Result: Clean build with no regressions
    Evidence: .sisyphus/evidence/task-1-build-check.txt
  ```

  **Commit**: YES
  - Message: `chore: remove console.log statements from production code`
  - Pre-commit: `pnpm lint`

- [x] 2. Type Safety Fixes

  **What to do**:
  - Fix existing LSP errors in the codebase:
    - `src/hooks/useChat.ts:22` - `getDroppedMessages` not exported from `chatWindow` module. Either export it or remove the import.
    - `src/hooks/useChat.ts:171` - Parameter `m` implicitly has `any` type. Add explicit type annotation.
    - `src/stores/__tests__/authExpiredFlow.test.ts` - `pendingRetryOperation` and related properties don't exist on `RepositoryState`. Either add these to the store type or update the test to match current store shape.
  - Fix `as any` type assertions:
    - `src/components/Plasma.tsx:193,195` - WebGL uniform type assertions. Replace with proper WebGL typing.
  - Fix non-null assertions without null checks:
    - `src/chat/ToolUseBlock.tsx:492,493` - `tool.result!` used without guard. Add null check.
    - `src/components/chat/MessageBubble.tsx:318` - `message.toolUses!` used without guard. Add null check.
  - Fix `as unknown` assertions:
    - `src/lib/agents/streamUtils.ts:49,55` - JSON parse result typed via `as unknown`. Use proper type guards.

  **Must NOT do**:
  - Do NOT introduce new `as any` to fix old ones
  - Do NOT change behavior -- only improve type safety
  - Do NOT modify test assertions (only type annotations)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T3, T4, T5, T6, T7)
  - **Blocks**: T8, T9, T11
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src/hooks/useChat.ts:22,171` - LSP errors: missing export + implicit any
  - `apps/desktop/src/stores/__tests__/authExpiredFlow.test.ts:65-121` - Store type mismatch in test
  - `apps/desktop/src/components/Plasma.tsx:193,195` - WebGL `as any` assertions
  - `apps/desktop/src/lib/agents/streamUtils.ts:49,55` - JSON parse `as unknown` assertions

  **API/Type References**:
  - `apps/desktop/src/stores/repositoryStore.ts` - RepositoryState type definition (check if pendingRetryOperation should exist)
  - `apps/desktop/src/lib/chatWindow.ts` - Verify getDroppedMessages export

  **Acceptance Criteria**:
  - [ ] `pnpm exec tsc --noEmit` in apps/desktop shows 0 errors
  - [ ] `grep -rn 'as any' apps/desktop/src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v node_modules | grep -v Plasma.tsx` returns 0 results (Plasma.tsx WebGL exempted only if no alternative)
  - [ ] All existing tests still pass

  **QA Scenarios:**
  ```
  Scenario: Zero TypeScript errors
    Tool: Bash
    Steps:
      1. Run: pnpm exec tsc --noEmit (in apps/desktop)
      2. Assert: exit code 0, no error output
    Expected Result: Clean TypeScript compilation
    Evidence: .sisyphus/evidence/task-2-tsc-check.txt

  Scenario: No as any in production code
    Tool: Bash
    Steps:
      1. Run: grep -rn 'as any' apps/desktop/src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v node_modules
      2. Count results
      3. Assert: only Plasma.tsx WebGL lines remain (if unavoidable)
    Expected Result: Zero or minimal as any usage
    Evidence: .sisyphus/evidence/task-2-type-safety.txt
  ```

  **Commit**: YES
  - Message: `fix: resolve type safety issues and LSP errors`
  - Pre-commit: `pnpm exec tsc --noEmit`

- [x] 3. Workspace Status Tracking

  **What to do**:
  - Add `status` field to workspace type in repositoryStore.ts: `'backlog' | 'in-progress' | 'in-review' | 'done'`
  - Default new workspaces to `'backlog'`
  - Auto-transition to `'in-progress'` when first chat message is sent
  - Auto-transition to `'in-review'` when PR is created
  - Auto-transition to `'done'` when workspace is archived
  - Allow manual status override via UI
  - Add status indicator pills to ProjectTree.tsx workspace list items
  - Add status filter/group option to workspace sidebar
  - Color coding: backlog=gray, in-progress=blue, in-review=yellow, done=green
  - Write TDD tests first:
    - Test: workspace starts as backlog
    - Test: status transitions on events (chat, PR, archive)
    - Test: manual status override works
    - Test: status persists across app restarts

  **Must NOT do**:
  - Do NOT compute status from git state (explicit status field, manually overridable)
  - Do NOT add drag-and-drop kanban board (just pills + filter in sidebar)
  - Do NOT modify workspace creation flow in onboarding

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`ui-styling`]
    - `ui-styling`: Status pills need proper Tailwind styling with color coding

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T4, T5, T6, T7)
  - **Blocks**: T15 (dashboard needs workspace status)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src/stores/repositoryStore.ts:128` - Workspace creation (add status field here)
  - `apps/desktop/src/stores/repositoryStore.ts:292` - createWorkspace function (set initial status)
  - `apps/desktop/src/components/layout/ProjectTree.tsx` - Workspace list items (add status pills here)

  **API/Type References**:
  - `apps/desktop/src/stores/repositoryStore.ts` - Workspace type definition
  - Conductor reference: Backlog > In Progress > In Review > Done (4 states)

  **Acceptance Criteria**:
  - [ ] New workspace has status 'backlog'
  - [ ] Sending first message transitions to 'in-progress'
  - [ ] Creating PR transitions to 'in-review'
  - [ ] Archiving transitions to 'done'
  - [ ] Status pills visible in workspace sidebar
  - [ ] Manual status change via click works

  **QA Scenarios:**
  ```
  Scenario: Workspace lifecycle status transitions
    Tool: Vitest
    Steps:
      1. Create new workspace via store action
      2. Assert: workspace.status === 'backlog'
      3. Simulate sending chat message (call the transition function)
      4. Assert: workspace.status === 'in-progress'
      5. Simulate PR creation event
      6. Assert: workspace.status === 'in-review'
      7. Archive workspace
      8. Assert: workspace.status === 'done'
    Expected Result: All 4 status transitions work correctly
    Evidence: .sisyphus/evidence/task-3-status-transitions.txt

  Scenario: Status pills render in ProjectTree
    Tool: Playwright
    Steps:
      1. Launch app, navigate to Build page
      2. Check workspace sidebar for status pill element
      3. Assert: pill has correct color class (e.g., bg-blue-500 for in-progress)
      4. Click pill to change status
      5. Assert: status updates in UI
    Expected Result: Visual status indicators present and interactive
    Evidence: .sisyphus/evidence/task-3-status-pills.png
  ```

  **Commit**: YES
  - Message: `feat(workspace): add workspace status tracking (backlog/in-progress/review/done)`
  - Pre-commit: `pnpm test`

- [x] 4. Chat Search (Cmd+F)

  **What to do**:
  - Create `ChatSearch` component with search input, match count, prev/next navigation
  - Bind to Cmd+F (Mac) / Ctrl+F (Linux) keyboard shortcut in ChatArea
  - Search through all messages in current workspace's chat history (chatStore)
  - Highlight matching text in message bubbles (yellow background)
  - Show match count: '3 of 12 matches'
  - Next/Previous buttons cycle through matches with scroll-to-match
  - Escape dismisses search bar
  - Search is case-insensitive by default, with optional case-sensitive toggle
  - Search within: message text content, code blocks, tool use descriptions
  - Performance: must handle 500+ messages without lag (debounce 150ms)
  - TDD tests:
    - Test: search finds matches across messages
    - Test: navigation cycles through matches
    - Test: empty search shows no results
    - Test: case-insensitive by default

  **Must NOT do**:
  - Do NOT search across workspaces (current workspace only)
  - Do NOT add regex search (plain text only)
  - Do NOT persist search state across workspace switches

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`ui-styling`]
    - `ui-styling`: Search bar overlay + highlight styling

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T5, T6, T7)
  - **Blocks**: T18
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src/components/chat/ChatArea.tsx` - Chat message rendering (add search bar here)
  - `apps/desktop/src/stores/chatStore.ts` - Message storage per workspace (search target)
  - Conductor reference: Cmd+F opens inline search within chat

  **Acceptance Criteria**:
  - [ ] Cmd+F opens search bar in chat area
  - [ ] Typing query highlights matches in messages
  - [ ] Match count displays correctly
  - [ ] Next/Previous navigation works
  - [ ] Escape dismisses search
  - [ ] Performance: <200ms response on 500 messages

  **QA Scenarios:**
  ```
  Scenario: Search finds and highlights matches
    Tool: Vitest + Playwright
    Steps:
      1. Create chat store with 10 messages containing various text
      2. Trigger search with query 'error'
      3. Assert: correct number of matches returned
      4. Assert: matched messages have highlight markers
      5. Navigate to next match
      6. Assert: scroll position changes to next match
    Expected Result: Search finds all occurrences and navigates between them
    Evidence: .sisyphus/evidence/task-4-chat-search.txt

  Scenario: Empty search and edge cases
    Tool: Vitest
    Steps:
      1. Search with empty string
      2. Assert: 0 matches, no highlights
      3. Search with string that has no matches
      4. Assert: 0 matches displayed
      5. Search with single character
      6. Assert: correct matches found
    Expected Result: Edge cases handled gracefully
    Evidence: .sisyphus/evidence/task-4-search-edge-cases.txt
  ```

  **Commit**: YES
  - Message: `feat(chat): add chat search with Cmd+F`
  - Pre-commit: `pnpm test`

- [x] 5. Context Usage Meter

  **What to do**:
  - Create `ContextMeter` component showing estimated context usage
  - Display as a progress bar in the chat area header or near the composer
  - Calculate rough context size: sum of message byte lengths (not token-accurate)
  - Show: 'Context: ~45KB / ~100KB' with visual bar
  - Color transitions: green (<50%), yellow (50-80%), red (>80%)
  - Hover tooltip shows breakdown: user messages, assistant messages, tool outputs
  - Warning indicator when approaching limit (>80%)
  - Per-workspace display (reads from chatStore for current workspace)
  - TDD tests:
    - Test: meter calculates rough byte size from messages
    - Test: color transitions at correct thresholds
    - Test: hover shows breakdown

  **Must NOT do**:
  - Do NOT count actual tokens (too expensive, use byte estimate)
  - Do NOT block sending messages when context is 'full'
  - Do NOT integrate with model-specific context limits (use a generic 100KB default)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`ui-styling`]
    - `ui-styling`: Progress bar with color transitions + tooltip

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T4, T6, T7)
  - **Blocks**: T18
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src/stores/chatStore.ts` - Message storage (calculate size from messages)
  - `apps/desktop/src/components/chat/ChatArea.tsx` - Place meter in chat header
  - Conductor reference: Context usage meter with breakdown on hover

  **Acceptance Criteria**:
  - [ ] Context meter visible in chat area
  - [ ] Shows estimated byte usage vs limit
  - [ ] Color changes at 50% and 80% thresholds
  - [ ] Hover tooltip shows message breakdown

  **QA Scenarios:**
  ```
  Scenario: Meter reflects context size correctly
    Tool: Vitest
    Steps:
      1. Create chatStore with known message sizes
      2. Render ContextMeter component
      3. Assert: displayed size matches sum of message bytes
      4. Add messages until >80% threshold
      5. Assert: meter turns red
    Expected Result: Accurate size display with correct color transitions
    Evidence: .sisyphus/evidence/task-5-context-meter.txt
  ```

  **Commit**: YES
  - Message: `feat(chat): add context usage meter`
  - Pre-commit: `pnpm test`

- [x] 6. Slash Commands Parser + Built-in Commands

  **What to do**:
  - Create `lib/slashCommands.ts` with command parser and registry
  - Parse messages starting with `/` as commands before sending to agent
  - Built-in commands:
    - `/clear` - Clear chat history for current workspace (BLOCKED while streaming)
    - `/review` - Trigger code review mode (sends diff to agent with review prompt)
    - `/restart` - Restart the agent process for current workspace
    - `/help` - Show available commands
  - Command autocomplete in composer: show dropdown when typing `/`
  - Slash command detection: intercept in useChat.ts before sendMessage
  - Registry pattern: commands register with name, description, handler function
  - TDD tests:
    - Test: /clear clears chat messages
    - Test: /clear blocked during streaming (returns error)
    - Test: /review generates review prompt with diff
    - Test: /help lists all commands
    - Test: unknown command shows error message

  **Must NOT do**:
  - Do NOT support custom per-repo commands (built-in only in v1)
  - Do NOT add command history or command-line editing
  - Do NOT allow /clear while agent is actively streaming

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T4, T5, T7)
  - **Blocks**: T10 (code review mode uses /review command)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src/hooks/useChat.ts` - Message sending flow (intercept slash commands here)
  - `apps/desktop/src/stores/chatStore.ts` - clearMessages action (for /clear)
  - `apps/desktop/src/components/chat/` - Composer component (add autocomplete dropdown)
  - Conductor reference: Custom slash commands in chat with autocomplete

  **Acceptance Criteria**:
  - [ ] /clear removes all messages from current workspace chat
  - [ ] /clear blocked while streaming (shows error toast)
  - [ ] /review collects git diff and sends to agent as review request
  - [ ] /restart kills and restarts agent process
  - [ ] /help shows command list
  - [ ] / in composer shows autocomplete dropdown
  - [ ] Unknown command shows error

  **QA Scenarios:**
  ```
  Scenario: Slash commands execute correctly
    Tool: Vitest
    Steps:
      1. Call parseSlashCommand('/clear')
      2. Assert: returns { command: 'clear', args: [] }
      3. Execute /clear handler
      4. Assert: chatStore messages are empty
      5. Set streaming state to true, attempt /clear
      6. Assert: handler returns error 'Cannot clear while agent is streaming'
    Expected Result: Commands parse and execute with proper guards
    Evidence: .sisyphus/evidence/task-6-slash-commands.txt

  Scenario: Unknown command handling
    Tool: Vitest
    Steps:
      1. Call parseSlashCommand('/foobar')
      2. Assert: returns unknown command error
      3. Call parseSlashCommand('not a command')
      4. Assert: returns null (not a slash command)
    Expected Result: Graceful handling of invalid commands
    Evidence: .sisyphus/evidence/task-6-unknown-commands.txt
  ```

  **Commit**: YES
  - Message: `feat(chat): add slash commands parser with built-in commands`
  - Pre-commit: `pnpm test`

- [x] 7. GitCoordinator Types + Interfaces

  **What to do**:
  - Create `lib/git/coordinator/types.ts` with TypeScript interfaces for git operation coordination
  - Define `GitOperation` type: { type, repoRoot, worktreePath, command, args, priority }
  - Define `GitCoordinator` interface: { enqueue, flush, getQueueStatus, cancelAll }
  - Define `WorktreeLifecycle` interface: { create, lock, unlock, repair, prune, list }
  - Define `AgentProcess` interface: { id, workspaceId, worktreePath, pid, status, startedAt }
  - Define priority levels: 'critical' (locks/repairs) > 'normal' (commits/pushes) > 'low' (status checks)
  - Add corresponding Tauri command type signatures that will be implemented in Rust (T12)
  - TDD tests:
    - Test: type definitions compile without errors
    - Test: mock coordinator satisfies interface

  **Must NOT do**:
  - Do NOT implement the actual coordinator (that's T12)
  - Do NOT add Rust code (types only)
  - Do NOT add dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T4, T5, T6)
  - **Blocks**: T12 (implementation depends on these types)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/desktop/src/lib/agents/types.ts` - Existing type definition pattern (follow this style)
  - `apps/desktop/src/lib/git/bridge.ts` - Existing git operations (these will be routed through coordinator)
  - `apps/desktop/src/stores/repositoryStore.ts` - Workspace type (AgentProcess references workspace)

  **API/Type References**:
  - `apps/desktop/src-tauri/src/lib.rs` - Existing Tauri commands (new commands will match these types)
  - Metis guidance: serialized queue with concurrency=1 per repo root

  **Acceptance Criteria**:
  - [ ] `pnpm exec tsc --noEmit` passes with new types
  - [ ] Types are exported and importable
  - [ ] Mock coordinator implements interface without errors

  **QA Scenarios:**
  ```
  Scenario: Types compile and are usable
    Tool: Bash
    Steps:
      1. Run: pnpm exec tsc --noEmit (in apps/desktop)
      2. Assert: no errors related to coordinator types
      3. Check: types are exported from the module
    Expected Result: Clean compilation with new type definitions
    Evidence: .sisyphus/evidence/task-7-types-check.txt
  ```

  **Commit**: YES
  - Message: `feat(git): add GitCoordinator types and interfaces`
  - Pre-commit: `pnpm exec tsc --noEmit`

- [x] 8. File Mentions (@) Completion

  **What to do**:
  - Extend existing MentionPopover.tsx to inject file CONTENT (not just path) into the chat message
  - First: audit MentionPopover to determine current behavior (path text vs content injection)
  - When user types @ in composer, show autocomplete dropdown of workspace files
  - On selection: insert file path as mention token AND attach file content to message context
  - File content should be sent to the agent as part of the message (like Conductor's drag-drop)
  - Support: .ts, .tsx, .js, .jsx, .json, .md, .css, .html, .py, .rs files
  - Max file size for inline content: 50KB (show warning for larger files)
  - TDD: test mention insertion, content attachment, file size limits

  **Must NOT do**:
  - Do NOT rewrite MentionPopover from scratch (extend existing)
  - Do NOT support binary file mentions (images, pdfs)
  - Do NOT load entire directory trees into context

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T9, T10, T11, T12)
  - **Blocks**: T18
  - **Blocked By**: T1, T2

  **References**:
  - `apps/desktop/src/components/chat/MentionPopover.tsx` - Existing mention UI (642 lines, audit first)
  - `apps/desktop/src/hooks/useChat.ts` - Message sending (attach file content here)
  - `apps/desktop/src/lib/agents/adapters/claudeCode.ts` - How content is passed to agent
  - Conductor: drag-drop files to mention them, content injected into context

  **Acceptance Criteria**:
  - [ ] @ in composer shows file autocomplete
  - [ ] Selecting file inserts mention token in message
  - [ ] File content attached to message context for agent
  - [ ] Files >50KB show warning
  - [ ] Agent receives file content (not just path)

  **QA Scenarios:**
  ```
  Scenario: File mention with content injection
    Tool: Vitest
    Steps:
      1. Create workspace with test files
      2. Trigger @ mention in composer
      3. Select a .ts file
      4. Assert: message includes file content in context
      5. Assert: file path shown as mention token in composer
    Expected Result: File content attached to message for agent
    Evidence: .sisyphus/evidence/task-8-file-mention.txt
  ```

  **Commit**: YES
  - Message: `feat(chat): complete file mentions with content injection`

- [x] 9. Image Attachments in Chat

  **What to do**:
  - Add image attachment support to chat composer
  - Drag-drop images onto composer area OR click attach button
  - Support: .png, .jpg, .jpeg, .gif, .webp, .svg
  - Display image thumbnail in composer before sending
  - Display image inline in sent message bubbles
  - For local CLI agents: pass image as base64 in message OR as file path reference
  - For cloud models: show warning 'Cloud models cannot access local images' but still send base64
  - Store images in workspace .context/ directory (like Conductor)
  - Max image size: 5MB
  - TDD: test drag-drop, display, size limits, agent format

  **Must NOT do**:
  - Do NOT support video or PDF attachments
  - Do NOT compress images (send as-is)
  - Do NOT store images in localStorage (use filesystem)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`ui-styling`]
    - `ui-styling`: Image thumbnail styling, drag-drop zone

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T8, T10, T11, T12)
  - **Blocks**: T18
  - **Blocked By**: T1, T2

  **References**:
  - `apps/desktop/src/components/chat/` - Composer component (add drop zone)
  - `apps/desktop/src/hooks/useChat.ts` - Message sending (attach image data)
  - `apps/desktop/src/lib/ideaMaze/storage.ts` - Existing image storage pattern (Tauri FS)
  - Conductor: drag-drop images into chat with inline display

  **Acceptance Criteria**:
  - [ ] Drag-drop image onto composer shows thumbnail preview
  - [ ] Sent message displays image inline
  - [ ] Image saved to workspace .context/ directory
  - [ ] >5MB images rejected with error
  - [ ] Cloud model warning shown when applicable

  **QA Scenarios:**
  ```
  Scenario: Image drag-drop and display
    Tool: Playwright
    Steps:
      1. Navigate to Build page with active workspace
      2. Drag test image onto composer area
      3. Assert: thumbnail preview appears in composer
      4. Click send
      5. Assert: image displayed inline in message bubble
    Expected Result: Full image attachment lifecycle works
    Evidence: .sisyphus/evidence/task-9-image-attach.png
  ```

  **Commit**: YES
  - Message: `feat(chat): add image attachment support`

- [x] 10. Code Review Mode

  **What to do**:
  - Implement /review slash command handler (depends on T6 slash parser)
  - When user types /review: collect git diff for current workspace
  - Send diff to agent with a code review prompt template
  - Review prompt: 'Review the following code changes. Identify bugs, security issues, style problems, and suggest improvements.'
  - Display agent's review response in chat as normal message
  - Support /review with optional scope: /review [file-path] to review specific file
  - TDD: test diff collection, prompt generation, scoped review

  **Must NOT do**:
  - Do NOT build inline annotation UI (review is chat-based output only)
  - Do NOT support multi-turn review conversations (single review per /review)
  - Do NOT add customizable review prompts per-repo (v1 uses fixed prompt)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T8, T9, T11, T12)
  - **Blocks**: T18
  - **Blocked By**: T6 (slash commands parser)

  **References**:
  - `apps/desktop/src/lib/slashCommands.ts` - Slash commands registry (from T6, register /review)
  - `apps/desktop/src/lib/git/bridge.ts` - Git diff operations
  - `apps/desktop/src/hooks/useChat.ts` - Send review prompt as message
  - Conductor: Cmd+Shift+R triggers AI code review of diff

  **Acceptance Criteria**:
  - [ ] /review collects workspace git diff
  - [ ] Sends diff + review prompt to agent
  - [ ] Agent response displayed as chat message
  - [ ] /review path.ts scopes to specific file

  **QA Scenarios:**
  ```
  Scenario: Code review via /review command
    Tool: Vitest
    Steps:
      1. Set up workspace with staged changes (mock git diff)
      2. Execute /review command handler
      3. Assert: diff content included in prompt
      4. Assert: review prompt template applied
      5. Assert: message sent to agent
    Expected Result: Review prompt with diff sent to agent
    Evidence: .sisyphus/evidence/task-10-code-review.txt
  ```

  **Commit**: YES
  - Message: `feat(chat): add code review mode via /review command`

- [x] 11. Checks Tab v2 (GitHub Actions)

  **What to do**:
  - Enhance existing Checks tab in RightPanel.tsx
  - Fetch GitHub Actions workflow runs for the current workspace's PR/branch
  - Use `gh` CLI: `gh run list --branch <branch> --json` and `gh run view <id> --json`
  - Display: workflow name, status (queued/in_progress/completed), conclusion (success/failure/cancelled)
  - For failed checks: show log output inline (expandable)
  - Re-run button: `gh run rerun <id>` for failed workflows
  - Auto-refresh every 30 seconds while tab is visible
  - Show deployment status if PR has Vercel/Cloudflare deployments
  - TDD: test API calls, status display, re-run flow

  **Must NOT do**:
  - Do NOT support non-GitHub CI (GitHub Actions only)
  - Do NOT cache check results (always fetch fresh)
  - Do NOT show checks for workspaces without a PR/remote branch

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`backend-development`]
    - `backend-development`: GitHub API integration, error handling

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T8, T9, T10, T12)
  - **Blocks**: T18
  - **Blocked By**: T1, T2

  **References**:
  - `apps/desktop/src/components/ide/RightPanel.tsx` - Existing Checks tab (enhance this)
  - `apps/desktop/src/lib/git/bridge.ts` - Git operations (add gh run commands)
  - `apps/desktop/src/lib/github/bridge.ts` - GitHub auth (ensure gh CLI authenticated)
  - Conductor: Checks tab with inline CI logs and re-run button

  **Acceptance Criteria**:
  - [ ] Checks tab shows GitHub Actions runs for current branch
  - [ ] Failed checks show expandable log output
  - [ ] Re-run button triggers `gh run rerun`
  - [ ] Auto-refresh every 30s
  - [ ] No checks message when no PR exists

  **QA Scenarios:**
  ```
  Scenario: GitHub Actions display and re-run
    Tool: Vitest + Playwright
    Steps:
      1. Mock gh CLI responses for workflow runs
      2. Render Checks tab with mock data
      3. Assert: workflow runs displayed with correct status icons
      4. Click on failed run
      5. Assert: log output expands
      6. Click re-run button
      7. Assert: gh run rerun command invoked
    Expected Result: CI status visible with actionable re-run
    Evidence: .sisyphus/evidence/task-11-checks-tab.png
  ```

  **Commit**: YES
  - Message: `feat(checks): add GitHub Actions logs and CI re-run`

- [x] 12. GitCoordinator Implementation (Serialized Queue)

  **What to do**:
  - Implement GitCoordinator in Rust (src-tauri/src/lib.rs or new module)
  - Serialized queue with concurrency=1 per repo root
  - All git commands MUST go through coordinator (no direct git calls from frontend)
  - Queue operations: enqueue, dequeue, peek, cancel
  - Priority levels: critical > normal > low (critical operations skip to front)
  - Expose as Tauri commands: `git_coordinator_enqueue`, `git_coordinator_status`
  - TypeScript bridge: wrap existing git/bridge.ts functions to use coordinator
  - Handle timeout: operations that take >60s are cancelled with error
  - Handle crash: if app crashes mid-operation, queue recovers on restart
  - TDD: test queue ordering, priority, concurrency, timeout

  **Must NOT do**:
  - Do NOT allow parallel git operations on same repo root
  - Do NOT use file locks (use in-memory Mutex/channel in Rust)
  - Do NOT change git operation semantics (coordinator is transparent)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`backend-development`]
    - `backend-development`: Rust async, tokio channels, Tauri commands

  **Parallelization**:
  - **Can Run In Parallel**: YES (but only with non-git tasks in Wave 2)
  - **Parallel Group**: Wave 2 (with T8, T9, T10, T11)
  - **Blocks**: T13, T14
  - **Blocked By**: T7 (types)

  **References**:
  - `apps/desktop/src/lib/git/coordinator/types.ts` - TypeScript interfaces from T7
  - `apps/desktop/src-tauri/src/lib.rs` - Existing Tauri commands (add coordinator commands alongside)
  - `apps/desktop/src/lib/git/bridge.ts` - Existing git ops (route through coordinator)
  - Metis guidance: serialized queue per repo root, tokio::sync::Mutex or mpsc channel

  **Acceptance Criteria**:
  - [ ] All git operations routed through coordinator
  - [ ] Concurrent operations on same repo are serialized (verified by test)
  - [ ] Priority ordering works (critical before normal)
  - [ ] 60s timeout cancels stuck operations
  - [ ] Queue status exposed via Tauri command

  **QA Scenarios:**
  ```
  Scenario: Serialized git operations prevent corruption
    Tool: Bash + Vitest
    Steps:
      1. Enqueue 3 git operations simultaneously on same repo
      2. Assert: operations execute sequentially (not parallel)
      3. Verify via timestamps: op2 starts after op1 completes
      4. Enqueue critical + normal operations
      5. Assert: critical executes first regardless of order
    Expected Result: Git operations serialized, priorities respected
    Evidence: .sisyphus/evidence/task-12-git-coordinator.txt

  Scenario: Timeout handling
    Tool: Vitest
    Steps:
      1. Enqueue operation that simulates 90s execution
      2. Assert: operation cancelled after 60s timeout
      3. Assert: queue continues processing next operation
    Expected Result: Stuck operations don't block queue
    Evidence: .sisyphus/evidence/task-12-timeout.txt
  ```

  **Commit**: YES
  - Message: `feat(git): implement GitCoordinator with serialized queue`

- [x] 13. Worktree Lifecycle Manager

  **What to do**:
  - Implement worktree lifecycle management in Rust + TypeScript
  - On worktree creation: call `git worktree lock --reason 'active-agent' <path>`
  - On worktree removal: call `git worktree unlock <path>` then `git worktree remove <path>`
  - On app startup (Tauri setup hook): run `git worktree repair` + `git worktree prune`
  - On agent process crash: clean up .git/index.lock files in worktree
  - Enforce one-branch-per-worktree: reject creation if branch already used by another worktree
  - Track worktree health status: healthy, orphaned, locked, corrupted
  - Expose via Tauri: `worktree_create`, `worktree_remove`, `worktree_repair`, `worktree_list`
  - Update repositoryStore.ts to use lifecycle manager instead of direct git calls
  - TDD: test create/lock/unlock/remove cycle, startup repair, crash recovery

  **Must NOT do**:
  - Do NOT allow `git rebase` in worktrees (use merge only)
  - Do NOT auto-delete worktrees on app quit (only on explicit archive/delete)
  - Do NOT modify .gitignore

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`backend-development`]
    - `backend-development`: Rust, git internals, process management

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T12 completing first)
  - **Parallel Group**: Wave 2 (sequential after T12)
  - **Blocks**: T14
  - **Blocked By**: T7, T12

  **References**:
  - `apps/desktop/src/lib/git/coordinator/types.ts` - WorktreeLifecycle interface from T7
  - `apps/desktop/src-tauri/src/lib.rs` - Existing worktree commands (enhance these)
  - `apps/desktop/src/stores/repositoryStore.ts:292` - createWorkspace (update to use lifecycle)
  - Metis guidance: lock on create, unlock before remove, repair on startup, clean index.lock on crash

  **Acceptance Criteria**:
  - [ ] Worktrees locked on creation
  - [ ] Worktrees unlocked and removed cleanly on archive
  - [ ] App startup runs repair + prune
  - [ ] Duplicate branch rejection works
  - [ ] Crash recovery cleans up .git/index.lock

  **QA Scenarios:**
  ```
  Scenario: Worktree lifecycle create/lock/unlock/remove
    Tool: Bash + Vitest
    Steps:
      1. Create worktree via lifecycle manager
      2. Assert: worktree exists on disk
      3. Assert: `git worktree list` shows it as locked
      4. Remove worktree via lifecycle manager
      5. Assert: worktree removed from disk
      6. Assert: `git worktree list` no longer shows it
    Expected Result: Full lifecycle works without orphaned worktrees
    Evidence: .sisyphus/evidence/task-13-worktree-lifecycle.txt

  Scenario: Startup repair recovers orphaned worktrees
    Tool: Bash
    Steps:
      1. Manually corrupt a worktree (delete directory but leave git ref)
      2. Run startup repair function
      3. Assert: `git worktree list` shows clean state
      4. Assert: no error on next worktree creation
    Expected Result: Orphaned worktrees cleaned up on startup
    Evidence: .sisyphus/evidence/task-13-startup-repair.txt
  ```

  **Commit**: YES
  - Message: `feat(git): add worktree lifecycle management`

- [x] 14. Concurrent Agent Process Manager

  **What to do**:
  - Create `lib/agents/processManager.ts` to spawn, monitor, and kill multiple CLI agent processes
  - Use Tauri shell commands to spawn agent processes (Claude Code, OpenCode, Cursor) in specific worktrees
  - Each workspace gets ONE agent process (one-to-one mapping)
  - Enforce MAX_CONCURRENT_AGENTS = 3 (configurable in settings, hard cap at 5)
  - Process lifecycle: spawn -> streaming -> idle -> killed
  - Monitor process health: detect crashes, hangs, OOM via exit codes and timeouts
  - On agent crash: clean up worktree index.lock, update UI status, offer restart
  - Track per-agent: PID, workspace ID, worktree path, start time, status, resource usage estimate
  - Expose Tauri commands: `agent_spawn`, `agent_kill`, `agent_list`, `agent_status`
  - Rust side: use tokio::process::Command for async process management
  - Wire into existing useChat.ts: when user switches workspace, route messages to correct agent
  - TDD: test spawn/kill lifecycle, max agent enforcement, crash detection

  **Must NOT do**:
  - Do NOT build inter-agent communication (agents are autonomous)
  - Do NOT allow >5 concurrent agents regardless of settings
  - Do NOT share context between agent processes

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`backend-development`]
    - `backend-development`: Rust async processes, tokio, Tauri shell integration

  **Parallelization**:
  - **Can Run In Parallel**: NO (critical path)
  - **Parallel Group**: Wave 3 (sequential after T12, T13)
  - **Blocks**: T15, T16, T17
  - **Blocked By**: T12, T13

  **References**:
  - `apps/desktop/src/lib/agents/adapters/claudeCode.ts` - Existing agent spawn pattern
  - `apps/desktop/src/lib/agents/adapters/opencode.ts` - Opencode spawn pattern
  - `apps/desktop/src/lib/git/coordinator/types.ts` - AgentProcess interface from T7
  - `apps/desktop/src-tauri/src/lib.rs` - Existing shell commands (run_claude_code_streaming, etc.)
  - Conductor model: one workspace = one worktree = one CLI process

  **Acceptance Criteria**:
  - [ ] Can spawn 3 concurrent agent processes
  - [ ] 4th spawn request blocked with 'Max agents reached' message
  - [ ] Agent crash detected and UI updated
  - [ ] Agent kill terminates process and cleans up
  - [ ] Process list shows all active agents with status

  **QA Scenarios:**
  ```
  Scenario: Spawn and manage 3 concurrent agents
    Tool: Vitest + Bash
    Steps:
      1. Spawn agent 1 in workspace A
      2. Assert: agent process running (check PID)
      3. Spawn agent 2 in workspace B
      4. Spawn agent 3 in workspace C
      5. Assert: 3 agents active in process list
      6. Attempt to spawn agent 4
      7. Assert: rejected with max agents error
      8. Kill agent 1
      9. Assert: agent 1 removed from list, workspace A shows idle
    Expected Result: Max 3 concurrent agents enforced
    Evidence: .sisyphus/evidence/task-14-process-manager.txt
  ```

  **Commit**: YES
  - Message: `feat(agents): implement concurrent agent process manager`

- [x] 15. Multi-Agent Dashboard UI

  **What to do**:
  - Create `AgentDashboard` component showing all active agents at a glance
  - Dashboard placement: collapsible panel in Layout.tsx (below workspace sidebar or as overlay)
  - For each active agent show: workspace name, branch, agent type, status (streaming/idle/error), elapsed time
  - Streaming indicator: animated dot or spinner when agent is actively generating
  - Click agent row to switch focus to that workspace's chat
  - Quick actions per agent: Kill, Restart, Open Chat
  - Show workspace status pills from T3 alongside agent status
  - Empty state when no agents running: 'No active agents. Create a workspace to start.'
  - Compact mode: just icons + workspace names (for narrow sidebars)
  - TDD: test render with 0/1/3 agents, status updates, click-to-switch

  **Must NOT do**:
  - Do NOT show multiple chat panels simultaneously (single focused chat)
  - Do NOT auto-play agent streaming in dashboard (summary status only)
  - Do NOT add drag-and-drop reordering

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`ui-styling`, `frontend-design`]
    - `ui-styling`: Dashboard cards, status indicators, animations
    - `frontend-design`: Layout integration, responsive design

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T16, after T14)
  - **Parallel Group**: Wave 3 (with T16)
  - **Blocks**: T17
  - **Blocked By**: T3, T14

  **References**:
  - `apps/desktop/src/components/layout/Layout.tsx` - App layout (add dashboard panel)
  - `apps/desktop/src/components/layout/ProjectTree.tsx` - Workspace sidebar pattern (follow style)
  - `apps/desktop/src/lib/agents/processManager.ts` - Process list from T14
  - `apps/desktop/src/stores/repositoryStore.ts` - Workspace data + status from T3
  - Conductor: left sidebar shows workspaces with status, streaming indicators

  **Acceptance Criteria**:
  - [ ] Dashboard shows all active agents with correct status
  - [ ] Click agent row switches to that workspace
  - [ ] Kill button terminates agent
  - [ ] Empty state renders when no agents active
  - [ ] Streaming indicator animates during generation

  **QA Scenarios:**
  ```
  Scenario: Dashboard renders active agents
    Tool: Playwright
    Steps:
      1. Launch app with 2 active agent workspaces
      2. Assert: dashboard shows 2 agent rows
      3. Assert: each row shows workspace name, status, agent type
      4. Click on agent row for workspace B
      5. Assert: chat switches to workspace B
    Expected Result: Dashboard accurately reflects agent state
    Evidence: .sisyphus/evidence/task-15-dashboard.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add multi-agent dashboard`

- [x] 16. Rate Limit Awareness + Resource Monitoring

  **What to do**:
  - Create `RateLimitMeter` component showing API rate limit status
  - Track estimated rate limit consumption across all active agents
  - For Anthropic: ~90k output tokens/min at Tier 2. With 3 agents = ~30k per agent
  - Display: 'API: ~60% of rate limit' with color-coded bar (green/yellow/red)
  - Warning banner when >80% of estimated rate limit consumed
  - Show per-agent resource estimate: approx RAM usage (200-400MB per agent)
  - System resource check before spawning new agent (via Tauri sysinfo crate)
  - If available memory <1GB, warn before spawning additional agent
  - Place meter near dashboard or in header bar
  - TDD: test rate estimation, threshold warnings, resource checks

  **Must NOT do**:
  - Do NOT implement actual rate limit tracking (estimate from message volume)
  - Do NOT block agent spawning based on rate limits (warning only)
  - Do NOT query actual API rate limit headers (estimate only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`ui-styling`]
    - `ui-styling`: Rate limit bar, warning banner

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T15, after T14)
  - **Parallel Group**: Wave 3 (with T15)
  - **Blocks**: T18
  - **Blocked By**: T14

  **References**:
  - `apps/desktop/src/lib/agents/processManager.ts` - Active agent count from T14
  - `apps/desktop/src-tauri/src/lib.rs` - System info (add sysinfo crate for RAM check)
  - Conductor: no explicit rate limit UI, but users report rate limit issues with many agents
  - Metis guidance: shared API limits across agents, 3 agents practical ceiling

  **Acceptance Criteria**:
  - [ ] Rate limit meter visible when 2+ agents active
  - [ ] Warning banner at >80% estimated usage
  - [ ] Memory warning before spawning agent if <1GB available
  - [ ] Color transitions: green -> yellow -> red

  **QA Scenarios:**
  ```
  Scenario: Rate limit warning with 3 agents
    Tool: Vitest
    Steps:
      1. Simulate 3 active agents with high message volume
      2. Assert: rate limit meter shows >60%
      3. Increase simulated volume past 80%
      4. Assert: warning banner appears
    Expected Result: Warning displayed at high utilization
    Evidence: .sisyphus/evidence/task-16-rate-limit.txt
  ```

  **Commit**: YES
  - Message: `feat(agents): add rate limit awareness and resource monitoring`

- [x] 17. Parallel Workspace Chat Routing

  **What to do**:
  - Modify chatStore.ts to support multiple simultaneous active chats
  - Current: one active workspace chat at a time. New: multiple background chats
  - Route messages to correct agent based on workspace ID
  - When user switches workspace in dashboard, switch displayed chat (preserve scroll position)
  - Background agents continue streaming even when their chat is not visible
  - Notification when background agent completes or errors (desktop notification from settings)
  - Update useChat.ts: accept workspaceId parameter, route to correct agent process
  - Message history remains per-workspace in localStorage
  - Test: concurrent messages across 3 workspaces don't cross-contaminate
  - TDD: test routing, background streaming, workspace switching, notification

  **Must NOT do**:
  - Do NOT display multiple chat panels simultaneously (single panel, switch between)
  - Do NOT merge message histories across workspaces
  - Do NOT auto-switch to a workspace when its agent finishes

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on T14 + T15)
  - **Parallel Group**: Wave 4 (sequential)
  - **Blocks**: T18
  - **Blocked By**: T14, T15

  **References**:
  - `apps/desktop/src/stores/chatStore.ts` - Per-workspace message storage (already keyed by ID)
  - `apps/desktop/src/hooks/useChat.ts` - Message sending (add workspace routing)
  - `apps/desktop/src/lib/agents/processManager.ts` - Agent-to-workspace mapping from T14
  - `apps/desktop/src/components/layout/Layout.tsx` - Workspace switching UI
  - Conductor: background agents stream while you focus on another workspace

  **Acceptance Criteria**:
  - [ ] Messages route to correct workspace agent
  - [ ] Background agent continues streaming when not focused
  - [ ] Switching workspace shows correct chat history
  - [ ] No message cross-contamination between workspaces
  - [ ] Desktop notification on background agent completion

  **QA Scenarios:**
  ```
  Scenario: Concurrent workspace chat routing
    Tool: Vitest
    Steps:
      1. Create 3 workspaces with active agents
      2. Send message to workspace A
      3. Switch to workspace B, send different message
      4. Switch back to workspace A
      5. Assert: workspace A shows only its messages
      6. Assert: workspace B shows only its messages
      7. Assert: no cross-contamination
    Expected Result: Complete chat isolation between workspaces
    Evidence: .sisyphus/evidence/task-17-chat-routing.txt
  ```

  **Commit**: YES
  - Message: `feat(agents): parallel workspace chat routing`

- [x] 18. Integration Testing (All Features)

  **What to do**:
  - Write comprehensive integration tests covering all new features working together
  - Test scenarios:
    - Create workspace -> status backlog -> send message -> status in-progress -> /review -> create PR -> status in-review -> archive -> status done
    - Spawn 3 agents -> monitor in dashboard -> kill one -> spawn new -> verify routing
    - Chat search while agent is streaming
    - Image attachment + file mention in same message
    - Slash command /clear in one workspace doesn't affect others
    - Context meter updates across workspace switches
    - Checks tab auto-refresh while agents run
    - Rate limit warning with 3 active agents
  - E2E tests via Playwright for UI integration
  - Unit tests via Vitest for store/hook integration
  - Verify all features work on both macOS and Linux
  - Run full test suite: `pnpm test` + `pnpm test:critical-flows`

  **Must NOT do**:
  - Do NOT test features in isolation (that's per-task QA)
  - Do NOT skip any feature combination
  - Do NOT modify implementation code (test-only changes)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`web-testing`]
    - `web-testing`: Playwright E2E, Vitest integration patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all T8-T17)
  - **Parallel Group**: Wave 4 (sequential after all features)
  - **Blocks**: F1-F4
  - **Blocked By**: T8-T17 (all implementation tasks)

  **References**:
  - `testing/e2e/` - Existing E2E test directory
  - `apps/desktop/src/hooks/__tests__/` - Existing unit test pattern
  - All T1-T17 task specs for expected behavior

  **Acceptance Criteria**:
  - [ ] All integration test scenarios pass
  - [ ] `pnpm test` passes with 0 failures
  - [ ] `pnpm build:desktop` succeeds
  - [ ] No regressions in existing features

  **QA Scenarios:**
  ```
  Scenario: Full feature integration
    Tool: Vitest + Playwright
    Steps:
      1. Run full integration test suite
      2. Assert: all scenarios pass
      3. Run pnpm test
      4. Assert: 0 failures
      5. Run pnpm build:desktop
      6. Assert: successful build
    Expected Result: All features work together without conflicts
    Evidence: .sisyphus/evidence/task-18-integration.txt
  ```

  **Commit**: YES
  - Message: `test: add integration tests for parallel agents and parity features`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection -> fix -> re-run.

- [x] F1. **Plan Compliance Audit** -- `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns -- reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** -- `unspecified-high`
      Run `tsc --noEmit` + linter + `pnpm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** -- `unspecified-high` (+ `playwright` skill if UI)
      Start from clean state. Execute EVERY QA scenario from EVERY task -- follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
      Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** -- `deep`
      For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 -- everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
      Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Tasks | Commit Message                                                                     | Files                                           |
| ----- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| T1    | `chore: remove console.log statements from production code`                        | 7+ files across src/                            |
| T2    | `fix: resolve type safety issues and LSP errors`                                   | 5+ files                                        |
| T3    | `feat(workspace): add workspace status tracking (backlog/in-progress/review/done)` | repositoryStore.ts, ProjectTree.tsx, Layout.tsx |
| T4    | `feat(chat): add chat search with Cmd+F`                                           | ChatArea.tsx, new ChatSearch component          |
| T5    | `feat(chat): add context usage meter`                                              | new ContextMeter component, ChatArea.tsx        |
| T6    | `feat(chat): add slash commands parser with built-in commands`                     | new slashCommands.ts, ChatComposer changes      |
| T7    | `feat(git): add GitCoordinator types and interfaces`                               | new lib/git/coordinator/types.ts                |
| T8    | `feat(chat): complete file mentions with content injection`                        | MentionPopover.tsx, useChat.ts                  |
| T9    | `feat(chat): add image attachment support`                                         | ChatComposer, new ImageAttachment component     |
| T10   | `feat(chat): add code review mode via /review command`                             | slashCommands.ts, useChat.ts                    |
| T11   | `feat(checks): add GitHub Actions logs and CI re-run`                              | RightPanel.tsx, new ChecksTab component         |
| T12   | `feat(git): implement GitCoordinator with serialized queue`                        | lib.rs, new coordinator module                  |
| T13   | `feat(git): add worktree lifecycle management`                                     | lib.rs, repositoryStore.ts                      |
| T14   | `feat(agents): implement concurrent agent process manager`                         | new lib/agents/processManager.ts, lib.rs        |
| T15   | `feat(ui): add multi-agent dashboard`                                              | new AgentDashboard component, Layout.tsx        |
| T16   | `feat(agents): add rate limit awareness and resource monitoring`                   | new RateLimitMeter, processManager.ts           |
| T17   | `feat(agents): parallel workspace chat routing`                                    | chatStore.ts, useChat.ts, Layout.tsx            |
| T18   | `test: add integration tests for parallel agents and parity features`              | testing/e2e/, new integration tests             |

---

## Success Criteria

### Verification Commands

```bash
pnpm test                     # Expected: all tests pass
pnpm build:desktop            # Expected: successful build
pnpm lint                     # Expected: no errors
grep -r "console.log" apps/desktop/src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v node_modules  # Expected: 0 results
grep -rn "as any" apps/desktop/src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v node_modules | grep -v Plasma.tsx  # Expected: 0 new results
```

### Final Checklist

- [x] All 18 tasks completed with QA evidence
- [x] All "Must Have" requirements present
- [x] All "Must NOT Have" guardrails respected
- [x] 3 parallel agents run without git corruption
- [x] All tests pass
- [x] No console.log in production code
- [x] No as any in new code
- [x] F1-F4 all APPROVE
