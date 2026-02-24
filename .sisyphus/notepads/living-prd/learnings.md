# Learnings — living-prd

## [2026-02-24] T1: PRDDocument Type System

### What was done

- Created `apps/desktop/src/lib/context/types.ts` with all required types:
  - `DependencyEdge`: Represents dependencies between nodes with optional reasoning
  - `Contradiction`: Tracks conflicting ideas with optional reasoning
  - `ScopeExclusion`: Marks ideas as rejected/alternative/dismissed with reason
  - `AcceptanceCriterion`: Captures acceptance criteria from node critiques
  - `PRDMetadata`: Metadata about PRD generation (source, counts)
  - `PRDDocument`: Main wrapper that holds PlanContent + all derived data
- Created barrel export in `apps/desktop/src/lib/context/index.ts`
- Implemented TDD: wrote 10 tests first, then types to pass them
- All tests passing, TypeScript clean, PlanContent unchanged

### Key patterns

- PRDDocument wraps PlanContent without modification (immutable reference)
- Optional `reasoning` fields on edges/contradictions for flexibility
- ScopeExclusion reason is a discriminated union: 'rejected' | 'alternative' | 'dismissed-critique'
- AcceptanceCriterion tracks source node and critique type for traceability
- All timestamps are ISO strings (not Date objects) for serialization

### No gotchas

- Types are pure (no runtime validation, no serialization logic)
- Import pattern: `import type { PlanContent } from '../ideaMaze/types'` keeps dependency clean
- Vitest tests work well for type-level assertions

## [2026-02-24] T2: Toast Notification System

**Summary**: Implemented a reusable toast notification system using Zustand + Framer Motion.

**Key Implementation Details**:

- **Store Pattern**: Used Zustand's `create()` with simple state mutations (no middleware needed for this simple case)
- **ID Generation**: Used `crypto.randomUUID()` for unique toast IDs
- **Auto-dismiss**: Handled in component via `useEffect` + `setTimeout`, NOT in store (keeps store pure)
- **Undo Pattern**: `undoToast()` calls callback then dismisses - callback fires before removal
- **Animation**: Framer Motion `motion.div` with slide-in (x: 100) and fade-out on exit
- **Container**: Used `AnimatePresence` with `mode="popLayout"` for smooth staggered animations
- **Styling**: Dark theme colors (green-950, yellow-950, blue-950) with border accents

**TDD Approach**:

- Wrote 4 failing tests first (showToast, dismissToast, undoToast, multiple coexist)
- Tests use `useToastStore.setState()` for reset and `getState()` for assertions
- All tests passed on first implementation (store logic was straightforward)

**Gotchas Avoided**:

- ❌ Did NOT put auto-dismiss logic in store (would require cleanup subscriptions)
- ❌ Did NOT use `as any` or `@ts-ignore` (full type safety maintained)
- ❌ Did NOT over-engineer with persistence or categories (kept minimal)

**Files Created**:

- `stores/toastStore.ts` (54 lines)
- `components/ui/Toast.tsx` (74 lines)
- `components/ui/ToastContainer.tsx` (20 lines)
- `stores/__tests__/toastStore.test.ts` (92 lines)
- Modified `App.tsx` to mount ToastContainer

**Verification**:

- ✅ All 453 tests pass (including 4 new toast tests)
- ✅ `tsc --noEmit` clean (no type errors)
- ✅ Commit: `feat(ui): add reusable toast notification system`

## [2026-02-24] T3: PRD Two-Phase Storage Service

**Summary**: Created `prdStorage.ts` with 4 functions implementing two-phase storage:

- Phase 1 (AppLocalData): `savePRDToAppData` / `loadPRDFromAppData` using `@tauri-apps/plugin-fs` + `BaseDirectory.AppLocalData`
- Phase 2 (Workspace): `copyPRDToWorkspace` / `loadPRDFromWorkspace` using `invoke()` IPC

**Tauri Mocking Patterns**:

- `@tauri-apps/plugin-fs`: Mock `BaseDirectory` as `{ AppLocalData: 'AppLocalData' }` (string enum stub)
- `@tauri-apps/api/core`: Mock `invoke` as `vi.fn()`, use `vi.mocked(invoke).mockResolvedValueOnce()`
- Pattern from snapshots.test.ts (plugin-fs) and projectMemory.test.ts (invoke) work well together

**IPC Param Names (from projectMemory.ts)**:

- `read_file` uses `{ filePath: ... }` (not `path`)
- `write_project_files` uses `{ baseDir: ..., files: [...] }` (not `workspacePath`)
- `read_file` returns `{ content: string }` (not raw string)

**Corrupted JSON Handling**:

- Nested try/catch: outer catches readTextFile errors (file missing), inner catches JSON.parse errors
- Only `console.warn` on parse failure, not on file-not-found (clean null return)

**Files**: `prdStorage.ts` (55 lines), `prdStorage.test.ts` (147 lines), 7 tests passing

## [2026-02-24] T4: PRD Generator

- Built `generatePRD(moodboard, planNode)` as a pure transformer in `apps/desktop/src/lib/context/prdGenerator.ts`.
- NodeCritique fields confirmed in `ideaMaze/types.ts`: `id`, `critique`, `suggestions`, `severity`, `createdAt`, `dismissed?` (no `perspective` on current type).
- Dismissed critiques map to `scopeExclusions`; undismissed non-info critiques map to `acceptanceCriteria`; alternatives are also mapped to `scopeExclusions`.
- `plan` is embedded by direct object reference from plan node content (no cloning/modification).

## [2026-02-24] T5: PRD Auto-Generation on Plan Creation

- Plan creation happens in `useIdeaMazeChat.ts` → `sendMessage` callback → `event.type === 'done'` handler → `parsePlanFromResponse` check (around line 469)
- The plan node is created via `createPlanNode()` then `addNode()`, variable name is `newNode`
- `isAIProcessing` is `true` when plan-creation logic runs (inside streaming callback, before `finally` block clears it) — cannot use `isAIProcessing` guard for PRD generation triggered by plan completion
- PRD generation wired at line ~493: after connections created, before interview state cleared
- Store field: `currentPRD: PRDDocument | null` with `setCurrentPRD` action added to `IdeaMazeState`
- `generatePRD` is synchronous, `savePRDToAppData` is fire-and-forget async
- Toast undo callback clears `currentPRD` back to null

## [2026-02-24] T6: PRD Auto-Regeneration on Maze Changes

- Store name: `useIdeaMazeStore`, field: `currentMoodboard` (not `moodboard`), `isAIProcessing`, `currentPRD`
- Subscription uses `useIdeaMazeStore.subscribe((state) => {...})` placed after store creation but outside the `typeof window` block so it runs in both browser and node test environments
- Change detection via snapshot comparison: `{nodeCount, connectionCount, planContentHash, critiqueHash}` — ignores position/dimensions/viewport/selection
- `previousPrdSnapshot` is set to `null` when PRD or moodboard goes null; on first non-null observation it seeds without triggering regeneration (avoids false positive on PRD load)
- Debounce: 2s via `setTimeout`, cleared+reset on each subsequent significant change
- Timer callback re-reads state via `getState()` to use latest data and re-checks guards
- `generatePRD` is synchronous; `savePRDToAppData` is fire-and-forget async with `.catch(() => {})`
- Toast undo captures `previousPRD` and `moodboardId` in closure for proper restore
- Test mocking: `vi.hoisted()` for mock refs + `vi.mock()` for prdGenerator, prdStorage, toastStore, storage; `vi.stubGlobal('localStorage', ...)` for localStorage
- tsc pitfall: `vi.fn()` mock `.mock.calls` tuple types don't know call shape — use `as unknown as [[{...}]]` cast, NOT `as any`

## [2026-02-24] T7: PRD Sidebar Card

- IDEPage layout: main content (flex-1) + right panel (w-80, border-l). PrdCard placed above RightPanel in a flex-col container with `flex-shrink-0` so it doesn't scroll with RightPanel content.
- Root `.gitignore` has `build/` which catches `components/build/` — must use `git add -f` for source files in that directory.
- `@testing-library/react` NOT available in desktop app — tests use `react-dom/client` createRoot + `act` from `react-dom/test-utils` directly.
- Framer Motion `AnimatePresence` exit animations never complete in jsdom (no real animation runtime) — element stays in DOM. Solved by using simple conditional `{isExpanded && <motion.div>}` instead of AnimatePresence for testability while keeping enter animation.
- PlanReferenceCard was orphaned (no imports anywhere) — safe to delete without side effects.
- Component test pattern: `data-testid` attributes + `container.querySelector('[data-testid="..."]')` + `dispatchEvent(new MouseEvent('click', { bubbles: true }))` for interaction.

## [2026-02-24] T8: Replace Markdown Handoff

- `buildFromPlan` lives in `apps/desktop/src/stores/ideaMazeStore.ts` (not repositoryStore); it creates workspace, links `sourcePlan`, seeds chat, then switches to Build tab.
- Markdown seeding previously used `formatPlanAsMarkdown(planContent)` with a `## Build from Plan` prefix; replaced with structured handoff message and PRD workspace copy.
- PRD handoff uses `useIdeaMazeStore.getState().currentPRD`; when present it calls `copyPRDToWorkspace(currentPRD, workspace.localPath)` fire-and-forget with `.catch(() => {})` to prevent unhandled rejections in test/runtime environments without Tauri invoke.
- New chat text behavior: with PRD -> `PRD loaded: {N} requirements, {M} dependencies. Your workspace is ready - start building!`; without PRD -> `Workspace ready - start building!`.
- `apps/desktop/testing/e2e/build-from-plan.spec.ts` assertions needed updates to expect structured message (no markdown content).
- Unit coverage added in `apps/desktop/src/stores/__tests__/repositoryStore.test.ts` for PRD copy call, structured message, and fallback path; required extending local mocks (`subscribeWithSelector`, `setCurrentPage`, and chat `addMessage`).

## [2026-02-24] T9: Build Agent Context Injection

- Context assembly in `useChat.ts` → `sendLocalAgentMessage` passes `systemPrompt: SYSTEM_PROMPT` to `adapter.sendMessage()` at line ~302
- PRD injected by appending `formatPRDForAgent(prd)` to `SYSTEM_PROMPT` with double newline separator
- `loadPRDFromWorkspace(workingDirectory)` called inside try/catch before `adapter.sendMessage` — graceful fallback on error or missing PRD
- Cloud model path (`sendCloudModelMessage`) does NOT use system prompt — PRD injection only applies to local agents (claude-code, opencode, cursor)
- Formatter in `prdFormatter.ts`: converts PRDDocument to markdown-like text with conditional sections (deps, contradictions, exclusions, acceptance criteria)
- Formatter includes `designNotes` and `technicalApproach` from PlanContent when present
- 10 tests cover all sections, empty section omission, and full population

## [2026-02-24] T10: Toast Message Enhancement with Counts

- **What changed**: Updated PRD generation and regeneration toast messages to include requirement/dependency counts
- **Files modified**:
  - `hooks/useIdeaMazeChat.ts`: Changed generation toast from "PRD generated from your plan" to template string with counts
  - `stores/ideaMazeStore.ts`: Changed regeneration toast from "PRD updated" to template string with counts
  - `stores/__tests__/ideaMazeStore.prd-regen.test.ts`: Updated test to use regex pattern matching for dynamic counts
- **Test updates**: Changed exact string match to `expect.stringMatching(/^PRD updated: \d+ requirements, \d+ dependencies$/)` to handle variable counts
- **Undo callbacks verified**:
  - T5 generation: `setCurrentPRD(null)` ✓
  - T6 regeneration: restores `previousPRD` ✓
- **Verification**: All 502 tests pass, TypeScript clean (exit 0)

## [2026-02-24] T11: E2E Integration Tests

- Added `testing/e2e/tests/living-prd-pipeline.spec.ts` with 7 Vitest integration scenarios covering generation, storage round-trip, workspace copy IPC, agent context formatting, empty maze, contradictions, and regeneration metadata updates.
- Existing `apps/desktop/testing/e2e/*.spec.ts` tests are Vitest-based integration tests (not Playwright browser E2E), and root `pnpm vitest run` currently executes workspace-scoped projects (`api`, `ui`, `desktop`, `acp-client`) rather than `testing/e2e/tests`.

## [2026-02-24] T12: Backward Compatibility + Cleanup
- Moved `testing/e2e/tests/living-prd-pipeline.spec.ts` → `apps/desktop/testing/e2e/living-prd-pipeline.spec.ts` so vitest workspace picks it up
- Fixed 5 import paths from `../../../apps/desktop/src/...` to `../../src/...` (relative paths changed with the move)
- No orphaned `PlanReferenceCard` imports found (deleted in T7, fully cleaned)
- No orphaned `planExporter` imports found (deprecated file exists but nothing imports it)
- `loadPRDFromWorkspace` returns `null` on missing file → `PrdCard` returns `null` → old workspaces degrade gracefully
- Final test count: 57 files, 509 tests (all pass), including 7 pipeline integration tests
