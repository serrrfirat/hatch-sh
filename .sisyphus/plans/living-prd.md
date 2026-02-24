# Living PRD + Context Thread (V1: Ideation Side)

## TL;DR

> **Quick Summary**: Replace the flat markdown handoff between Idea Maze and Build with a structured "Living PRD" system. The Idea Maze's rich topology (nodes, semantic connections, critiques, interview decisions) becomes a persistent, structured Product Requirements Document stored in `.hatch/context/`. The Build agent receives structured requirements — not prose — and the Build tab shows the PRD as a pinned reference card.
>
> **Deliverables**:
>
> - `PRDDocument` type system wrapping existing `PlanContent`
> - PRD generator that converts maze topology → structured spec
> - Two-phase file storage (appDataDir → workspace copy on build)
> - Reusable toast notification system with undo
> - Pinned PRD card in Build tab (activating orphaned `PlanReferenceCard.tsx`)
> - Structured agent context injection replacing markdown handoff
> - Auto-regeneration on significant maze changes with "Memory updated" notification
>
> **Estimated Effort**: Medium-Large
> **Parallel Execution**: YES — 4 waves + final verification
> **Critical Path**: Task 1 → Task 4 → Task 8 → Task 9 → Task 11 → Final

---

## Context

### Original Request

User wants to build the "Context Thread" — a persistent project memory that threads intent, decisions, and constraints across Hatch's pipeline stages. V1 focuses on the ideation side: converting Idea Maze topology into a Living PRD that replaces the current markdown handoff to the Build agent.

### Interview Summary

**Key Discussions**:

- **Scope**: One unified feature (Context Thread + Living PRD), V1 is ideation side only
- **Storage**: Local file-based in `.hatch/context/`, git-friendly, human-readable JSON
- **Memory behavior**: Auto-capture with "Memory updated" notification + undo
- **Migration**: Replaces existing markdown handoff entirely
- **Testing**: TDD approach throughout
- **V2 (excluded)**: Build-side memory (code conventions, cross-session patterns), post-deploy feedback

**Research Findings**:

- No tool connects brainstorming → specification → verification as one continuous loop
- AWS Kiro does `requirements.md → tasks.md` from flat text; Hatch does it from a visual spatial canvas
- The "living spec" concept is emerging but nobody has cracked it for solo developers
- Current PlanContent already has structured fields but handoff flattens to markdown, losing 90% of data

### Metis Review

**Identified Gaps** (addressed):

- **Storage location chicken-and-egg**: PRD generated before workspace exists → Two-phase storage: save with moodboard (appDataDir), copy to workspace on build
- **PlanContent modification risk**: PlanContent used in 7+ files → PRDDocument WRAPS PlanContent, never modifies it
- **`projectMemory.ts` already exists**: Uses `.hatch/context.md` with Tauri IPC → Follow this pattern exactly
- **`PlanReferenceCard.tsx` is orphaned**: Built but never imported → Activate and evolve it for PRD sidebar
- **Toast system doesn't exist**: No notification infrastructure → Build reusable toast as foundation
- **Auto-capture noise risk**: Triggering on every node edit is too noisy → Only trigger on significant changes (plan creation, regeneration, connection changes)
- **Multiple plan nodes**: Moodboard can have multiple plans → Most recent plan becomes PRD, with selection option
- **Dismissed critiques**: Include as "Considered and rejected" in PRD scope exclusions
- **`.hatch/` gitignore**: Not in any gitignore currently → Recommend committing (project context, like `.vscode/`)

---

## Work Objectives

### Core Objective

Replace the lossy markdown handoff between Idea Maze and Build with a structured, persistent PRD system that preserves the full semantic richness of the maze topology (connections, dependencies, critiques, exclusions) and presents it as structured context to the Build agent.

### Concrete Deliverables

- `PRDDocument` TypeScript type in `apps/desktop/src/lib/context/types.ts`
- `prdGenerator.ts` that converts maze state → `PRDDocument`
- `prdStorage.ts` with two-phase save (appDataDir + workspace copy)
- `toastStore.ts` + `Toast.tsx` reusable notification system
- Evolved `PlanReferenceCard.tsx` as pinned PRD card in Build tab
- Modified `buildFromPlan()` flow using structured PRD instead of markdown
- Modified `useChat.ts` with PRD context injection into agent prompt
- Auto-regeneration triggers in `ideaMazeStore.ts`

### Definition of Done

- [ ] `bun run --cwd apps/desktop tsc --noEmit` passes (zero type errors)
- [ ] All new PRD tests pass (`bun test` in relevant paths)
- [ ] All existing E2E tests pass (`build-from-plan.spec.ts` — 6 tests)
- [ ] Full pipeline works: Idea Maze → Plan → PRD → Build tab shows structured card → Agent receives structured context
- [ ] "Memory updated" toast appears on PRD generation/regeneration with working undo

### Must Have

- PRD preserves dependency ordering from `depends-on` connections
- PRD flags contradictions from `contradicts` connections
- PRD includes acceptance criteria derived from critique responses
- PRD includes "Out of scope" section from rejected/alternative ideas
- Build agent receives structured requirements, not flattened prose
- Existing `buildFromPlan()` E2E tests pass at every step

### Must NOT Have (Guardrails)

- **Must NOT modify `PlanContent` type** — it's used in 7+ files; PRDDocument wraps it
- **Must NOT use `@tauri-apps/plugin-fs` for workspace files** — use `invoke('write_project_files')` IPC pattern from `projectMemory.ts`
- **Must NOT add file watchers** — app knows when PRD changes; no need for FS watching
- **Must NOT build bidirectional sync** (Build → Maze) — V1 is Maze → PRD only
- **Must NOT add PRD version history** — git handles that (PRD is in workspace)
- **Must NOT add AI-generated PRD enrichment** — V1 captures user decisions only
- **Must NOT fire auto-capture during AI processing** — check `isAIProcessing` flag
- **Must NOT auto-capture on every node position/style change** — only significant changes (plan creation, connection add/remove, plan edit)
- **Must NOT break existing Build tab chat layout** — PRD card integrates without disrupting ChatArea scroll

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES (Vitest + Playwright)
- **Automated tests**: TDD (RED → GREEN → REFACTOR)
- **Framework**: Vitest for unit/integration, Playwright for E2E
- **Each task follows**: Write failing test → minimal implementation → refactor

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **Unit/Integration**: Use Bash (vitest) — Run tests, assert pass counts
- **Type Safety**: Use Bash (`tsc --noEmit`) — Assert zero errors

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — start immediately, MAX PARALLEL):
├── Task 1: PRDDocument type system [quick]
├── Task 2: Toast notification infrastructure [quick]
└── Task 3: PRD storage service (two-phase) [unspecified-high]

Wave 2 (Core Logic — after Wave 1):
├── Task 4: PRD generator (maze topology → PRDDocument) [deep]
├── Task 5: PRD auto-generation on plan creation [unspecified-high]
└── Task 6: PRD auto-regeneration on maze changes [unspecified-high]

Wave 3 (Integration — after Wave 2):
├── Task 7: PRD sidebar card in Build tab [visual-engineering]
├── Task 8: Replace markdown handoff with structured PRD [deep]
├── Task 9: Build agent context injection [unspecified-high]
└── Task 10: "Memory updated" toast integration [quick]

Wave 4 (Verification — after Wave 3):
├── Task 11: E2E integration test (full pipeline) [deep]
└── Task 12: Backward compatibility + cleanup [unspecified-high]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 4 → Task 8 → Task 9 → Task 11 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 3 (Waves 1 & 3)
```

### Dependency Matrix

| Task | Depends On  | Blocks           | Wave |
| ---- | ----------- | ---------------- | ---- |
| 1    | —           | 4, 5, 6, 7, 8, 9 | 1    |
| 2    | —           | 10               | 1    |
| 3    | 1           | 5, 6, 8, 9       | 1    |
| 4    | 1           | 5, 6, 8, 9, 11   | 2    |
| 5    | 1, 3, 4     | 10, 11           | 2    |
| 6    | 1, 3, 4     | 10, 11           | 2    |
| 7    | 1           | 11               | 3    |
| 8    | 1, 3, 4, 5  | 9, 11            | 3    |
| 9    | 1, 3, 8     | 11               | 3    |
| 10   | 2, 5, 6     | 11               | 3    |
| 11   | 7, 8, 9, 10 | 12               | 4    |
| 12   | 11          | F1-F4            | 4    |

### Agent Dispatch Summary

- **Wave 1**: 3 tasks — T1 `quick`, T2 `quick`, T3 `unspecified-high`
- **Wave 2**: 3 tasks — T4 `deep`, T5 `unspecified-high`, T6 `unspecified-high`
- **Wave 3**: 4 tasks — T7 `visual-engineering`, T8 `deep`, T9 `unspecified-high`, T10 `quick`
- **Wave 4**: 2 tasks — T11 `deep`, T12 `unspecified-high`
- **FINAL**: 4 tasks — F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [ ] 1. PRDDocument Type System

  **What to do**:
  - Create `apps/desktop/src/lib/context/types.ts` with `PRDDocument` type that WRAPS `PlanContent` (never modifies it)
  - PRDDocument fields: `id`, `version`, `createdAt`, `updatedAt`, `plan: PlanContent` (the existing data), `dependencyGraph: DependencyEdge[]` (from depends-on connections), `contradictions: Contradiction[]` (from contradicts connections), `scopeExclusions: ScopeExclusion[]` (from rejected/alternative ideas + dismissed critiques), `acceptanceCriteria: AcceptanceCriterion[]` (from critique responses), `metadata: PRDMetadata` (sourceMoodboardId, generatedFrom, nodeCount, connectionCount)
  - Include `DependencyEdge`, `Contradiction`, `ScopeExclusion`, `AcceptanceCriterion`, `PRDMetadata` supporting types
  - Write TDD tests FIRST: validate type construction, verify PlanContent is embedded not modified, test edge cases (empty plan, no connections, no critiques)
  - Export all types from a barrel `apps/desktop/src/lib/context/index.ts`

  **Must NOT do**:
  - Must NOT import or modify `PlanContent` in `lib/ideaMaze/types.ts`
  - Must NOT add runtime validation (types only, this is TypeScript)
  - Must NOT add serialization logic (that's Task 3)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Pure TypeScript type definitions with simple unit tests. No complex logic.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6, 7, 8, 9
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `apps/desktop/src/lib/ideaMaze/types.ts` — Existing `PlanContent`, `IdeaNode`, `IdeaConnection`, `NodeCritique` types. PRDDocument must reference these types without modifying them. Copy the naming conventions (PascalCase, optional fields with `?`).
  - `apps/desktop/src/lib/ideaMaze/types.ts:PlanContent` — Exact shape: `{ type: 'plan', id: string, summary: string, requirements: string[], designNotes?: string, technicalApproach?: string, sourceIdeaIds: string[] }`. PRDDocument.plan must be exactly this type.
  - `apps/desktop/src/lib/ideaMaze/types.ts:IdeaConnection` — Connection model: `{ id, sourceId, targetId, relationship: 'related'|'depends-on'|'contradicts'|'extends'|'alternative', type, aiSuggested, confidence, reasoning }`. The generator (Task 4) will consume these; your types must represent the extracted graph.

  **Test References**:
  - `apps/desktop/src/lib/ideaMaze/__tests__/` — If tests exist here, follow the pattern. Otherwise, create `apps/desktop/src/lib/context/__tests__/types.test.ts` using Vitest conventions from the project.

  **Acceptance Criteria**:
  - [ ] `bun run --cwd apps/desktop tsc --noEmit` → exit 0 (zero type errors)
  - [ ] Test file `apps/desktop/src/lib/context/__tests__/types.test.ts` exists and passes
  - [ ] `PRDDocument` type includes `plan: PlanContent` field (verified by test)
  - [ ] `PlanContent` type in `lib/ideaMaze/types.ts` is UNCHANGED (verified by git diff)
  - [ ] All supporting types exported from `lib/context/index.ts`

  **QA Scenarios:**

  ```
  Scenario: PRDDocument type compiles with valid PlanContent
    Tool: Bash (vitest)
    Preconditions: types.ts created with all types defined
    Steps:
      1. Run `bun test apps/desktop/src/lib/context/__tests__/types.test.ts`
      2. Assert test creates a valid PRDDocument object with all required fields
      3. Assert PlanContent is embedded as-is (not spread/modified)
    Expected Result: All tests pass, exit code 0
    Failure Indicators: Type errors, missing fields, PlanContent modified
    Evidence: .sisyphus/evidence/task-1-type-compilation.txt

  Scenario: PlanContent type unchanged
    Tool: Bash (git diff)
    Preconditions: Implementation complete
    Steps:
      1. Run `git diff apps/desktop/src/lib/ideaMaze/types.ts`
      2. Assert output is empty (no changes to this file)
    Expected Result: Zero diff on types.ts
    Failure Indicators: Any modification to PlanContent or related types
    Evidence: .sisyphus/evidence/task-1-no-plan-content-change.txt
  ```

  **Commit**: YES (standalone)
  - Message: `feat(context): add PRDDocument type system`
  - Files: `apps/desktop/src/lib/context/types.ts`, `apps/desktop/src/lib/context/index.ts`, `apps/desktop/src/lib/context/__tests__/types.test.ts`
  - Pre-commit: `bun run --cwd apps/desktop tsc --noEmit`

- [ ] 2. Reusable Toast Notification System

  **What to do**:
  - Create `apps/desktop/src/stores/toastStore.ts` — Zustand store for toast state
  - Fields: `toasts: Toast[]` where Toast = `{ id, message, type: 'info'|'success'|'warning', undoCallback?: () => void, dismissTimeout: number, createdAt }`
  - Actions: `showToast(opts)`, `dismissToast(id)`, `undoToast(id)` (fires callback then dismisses)
  - Auto-dismiss after configurable timeout (default 5s). Clear timeout if user interacts.
  - Create `apps/desktop/src/components/ui/Toast.tsx` — Animated toast component (Framer Motion, matches existing animation patterns)
  - Create `apps/desktop/src/components/ui/ToastContainer.tsx` — Renders active toasts, positioned bottom-right
  - Write TDD tests FIRST: test show/dismiss lifecycle, test undo callback fires, test auto-dismiss timing, test multiple toasts stack
  - Mount `ToastContainer` in `App.tsx` (global, always available)

  **Must NOT do**:
  - Must NOT build a full notification center (no queuing, persistence, categories)
  - Must NOT add sound effects or desktop notifications (that's existing settings)
  - Must NOT over-style — match existing TailwindCSS patterns in the codebase

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`ui-styling`]
    - `ui-styling`: Toast UI needs TailwindCSS styling matching existing design patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 10
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `apps/desktop/src/stores/chatStore.ts` — Zustand store pattern to follow: `create<StoreType>()(...)` with actions as methods. Follow the same structure.
  - `apps/desktop/src/stores/settingsStore.ts` — Zustand persist pattern if persistence is needed (it's not for toasts, but reference the store creation pattern).
  - `apps/desktop/src/components/ideaMaze/IdeaCard.tsx` — Framer Motion animation patterns used in the codebase. Match `motion.div` usage, easing, and duration conventions.
  - `apps/desktop/src/App.tsx` — Where to mount `ToastContainer`. See how the Layout component wraps pages.

  **Test References**:
  - `apps/desktop/src/stores/__tests__/` — If store tests exist, follow pattern. Otherwise use Vitest with `@testing-library/react` if available, or plain Vitest for store logic tests.

  **Acceptance Criteria**:
  - [ ] `bun run --cwd apps/desktop tsc --noEmit` → exit 0
  - [ ] `bun test apps/desktop/src/stores/__tests__/toastStore.test.ts` → PASS (4+ tests)
  - [ ] `bun test apps/desktop/src/components/ui/__tests__/Toast.test.ts` → PASS
  - [ ] ToastContainer mounted in App.tsx
  - [ ] Toast auto-dismisses after timeout
  - [ ] Undo callback fires when undo clicked

  **QA Scenarios:**

  ```
  Scenario: Toast appears and auto-dismisses
    Tool: Bash (vitest)
    Preconditions: toastStore created, Toast component created
    Steps:
      1. Run `bun test apps/desktop/src/stores/__tests__/toastStore.test.ts`
      2. Test calls `showToast({ message: 'Test', type: 'success', dismissTimeout: 100 })`
      3. Assert toast is in store.toasts array
      4. Wait 150ms, assert toast is removed
    Expected Result: Toast lifecycle complete, all assertions pass
    Failure Indicators: Toast doesn't appear, doesn't dismiss, or throws
    Evidence: .sisyphus/evidence/task-2-toast-lifecycle.txt

  Scenario: Undo callback fires correctly
    Tool: Bash (vitest)
    Preconditions: toastStore with undo support
    Steps:
      1. Create mock undo function
      2. Call `showToast({ message: 'Undo test', undoCallback: mockFn })`
      3. Call `undoToast(toastId)`
      4. Assert mockFn was called exactly once
      5. Assert toast is dismissed after undo
    Expected Result: Undo fires, toast dismissed
    Failure Indicators: Callback not called, toast persists
    Evidence: .sisyphus/evidence/task-2-toast-undo.txt
  ```

  **Commit**: YES (standalone)
  - Message: `feat(ui): add reusable toast notification system`
  - Files: `stores/toastStore.ts`, `components/ui/Toast.tsx`, `components/ui/ToastContainer.tsx`, `App.tsx` (mount point), tests
  - Pre-commit: `bun run --cwd apps/desktop tsc --noEmit`

- [ ] 3. PRD Two-Phase Storage Service

  **What to do**:
  - Create `apps/desktop/src/lib/context/prdStorage.ts` with two-phase storage:
    - **Phase 1 (appDataDir)**: Save PRDDocument alongside moodboard in `~/.local/share/sh.hatch.desktop/idea-maze/prd/{moodboardId}.json`. This handles the chicken-and-egg problem (PRD exists before workspace).
    - **Phase 2 (workspace)**: When `buildFromPlan()` creates workspace, copy PRD to `{workspace.localPath}/.hatch/context/prd.json`. This makes it git-friendly.
  - Functions: `savePRDToAppData(moodboardId, prd)`, `loadPRDFromAppData(moodboardId)`, `copyPRDToWorkspace(prd, workspacePath)`, `loadPRDFromWorkspace(workspacePath)`
  - Use Tauri IPC pattern (`invoke('write_file')`, `invoke('read_file')`) from `projectMemory.ts` for workspace writes. Use `@tauri-apps/plugin-fs` for appDataDir writes (matches moodboard storage pattern in `storage.ts`).
  - Handle errors gracefully: missing file → return null, corrupted JSON → log warning + return null
  - Write TDD tests: mock `invoke()` and plugin-fs, test save/load round-trip, test missing file handling, test corruption handling

  **Must NOT do**:
  - Must NOT add file watchers
  - Must NOT add versioning (git handles workspace-side versioning)
  - Must NOT use `@tauri-apps/plugin-fs` for workspace-scoped files (only appDataDir)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Involves Tauri IPC patterns and two different storage mechanisms. Needs careful attention to the distinction between appDataDir and workspace file I/O.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 5, 6, 8, 9
  - **Blocked By**: Task 1 (needs PRDDocument type)

  **References**:

  **Pattern References**:
  - `apps/desktop/src/lib/ideaMaze/storage.ts` — The moodboard storage pattern. Uses `@tauri-apps/plugin-fs` (`writeTextFile`, `readTextFile`, `mkdir`, `exists`) with `BaseDirectory.AppLocalData`. Follow this EXACTLY for appDataDir storage (Phase 1).
  - `apps/desktop/src/lib/ideaMaze/storage.ts:saveMoodboard()` — Debounced save with JSON serialization. Follow the error handling pattern (try/catch with console.error).
  - `apps/desktop/src/hooks/useChat.ts` — Contains `readProjectMemory()` function at lines ~19-50 that reads `.hatch/context.md` via `invoke('read_file')`. Follow this IPC pattern for workspace reads (Phase 2).
  - `apps/desktop/src/hooks/useChat.ts:writeProjectMemory()` — Uses `invoke('write_project_files')` for workspace writes. Follow this for copying PRD to workspace.
  - `apps/desktop/src/stores/repositoryStore.ts:buildFromPlan()` — The function that creates workspaces. This is where Phase 2 copy will be called from (Task 8 will integrate it).

  **API/Type References**:
  - Task 1's `PRDDocument` type from `lib/context/types.ts`

  **Test References**:
  - `apps/desktop/src/lib/ideaMaze/__tests__/storage.test.ts` — If exists, follow mocking patterns for Tauri APIs.
  - `apps/desktop/src/hooks/__tests__/useChat.test.ts` — If exists, follow `invoke()` mocking patterns.

  **Acceptance Criteria**:
  - [ ] `bun run --cwd apps/desktop tsc --noEmit` → exit 0
  - [ ] `bun test apps/desktop/src/lib/context/__tests__/prdStorage.test.ts` → PASS (6+ tests)
  - [ ] Round-trip test: savePRDToAppData → loadPRDFromAppData returns identical data
  - [ ] Missing file returns null (not throws)
  - [ ] Corrupted JSON returns null with console.warn
  - [ ] copyPRDToWorkspace uses invoke() IPC (not plugin-fs)

  **QA Scenarios:**

  ```
  Scenario: PRD save/load round-trip via appDataDir
    Tool: Bash (vitest)
    Preconditions: prdStorage.ts created, Tauri APIs mocked
    Steps:
      1. Run `bun test apps/desktop/src/lib/context/__tests__/prdStorage.test.ts`
      2. Test creates a PRDDocument, calls savePRDToAppData('test-id', prd)
      3. Test calls loadPRDFromAppData('test-id')
      4. Assert loaded PRD deep-equals saved PRD
    Expected Result: Round-trip preserves all data, tests pass
    Failure Indicators: Data loss, serialization errors, Tauri mock failures
    Evidence: .sisyphus/evidence/task-3-storage-roundtrip.txt

  Scenario: Missing file returns null gracefully
    Tool: Bash (vitest)
    Preconditions: prdStorage.ts with error handling
    Steps:
      1. Mock Tauri readTextFile to throw 'file not found'
      2. Call loadPRDFromAppData('nonexistent-id')
      3. Assert returns null (not throws)
    Expected Result: null returned, no crash
    Failure Indicators: Exception thrown, undefined returned
    Evidence: .sisyphus/evidence/task-3-missing-file.txt
  ```

  **Commit**: YES (standalone)
  - Message: `feat(context): add PRD two-phase storage service`
  - Files: `lib/context/prdStorage.ts`, tests
  - Pre-commit: `bun run --cwd apps/desktop tsc --noEmit && bun test apps/desktop/src/lib/context/`

- [ ] 4. PRD Generator (Maze Topology → PRDDocument)

  **What to do**:
  - Create `apps/desktop/src/lib/context/prdGenerator.ts` with function `generatePRD(moodboard: Moodboard, planNode: IdeaNode): PRDDocument`
  - Extract dependency graph: filter connections where `relationship === 'depends-on'`, build `DependencyEdge[]` with source/target node titles and the connection reasoning
  - Extract contradictions: filter `contradicts` connections, build `Contradiction[]` with both sides and the tension description
  - Extract scope exclusions: find nodes connected via `alternative` relationships + dismissed critiques (`NodeCritique.dismissed === true`), create `ScopeExclusion[]` with reason
  - Extract acceptance criteria: from undismissed critiques (`dismissed === false`) where `severity !== 'info'`, convert critique + suggestions into `AcceptanceCriterion[]`
  - Embed the existing `PlanContent` from the plan node as-is (no modification)
  - Compute metadata: sourceMoodboardId, node count, connection count, generation timestamp
  - Handle edge cases: empty moodboard → return PRD with empty arrays; no connections → empty graphs; no critiques → empty acceptance criteria; multiple plan nodes → use the provided planNode parameter
  - Write TDD tests FIRST: test with rich maze (10 nodes, 15 connections, 5 critiques), test with empty maze, test with maze missing plan node, test dependency ordering, test contradiction extraction, test dismissed vs undismissed critique filtering

  **Must NOT do**:
  - Must NOT call AI/LLM to enrich the PRD (V1 is structural extraction only)
  - Must NOT modify any maze data (pure function, read-only)
  - Must NOT filter by connection `aiSuggested` flag (include all accepted connections)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - Reason: Core business logic requiring careful graph traversal and data transformation. Multiple edge cases to handle correctly.

  **Parallelization**:
  - **Can Run In Parallel**: YES (within Wave 2)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6 once dependencies met)
  - **Blocks**: Tasks 5, 6, 8, 9, 11
  - **Blocked By**: Task 1 (needs PRDDocument type)

  **References**:

  **Pattern References**:
  - `apps/desktop/src/lib/ideaMaze/types.ts` — ALL types this function consumes: `Moodboard` (has `.nodes`, `.connections`), `IdeaNode` (has `.content[]`, `.critiques[]`, `.tags`), `IdeaConnection` (has `.relationship`, `.reasoning`, `.confidence`), `NodeCritique` (has `.critique`, `.suggestions`, `.severity`, `.dismissed`), `PlanContent` (embedded in node.content where type === 'plan')
  - `apps/desktop/src/lib/ideaMaze/planExporter.ts` — The function being REPLACED. Study `formatPlanAsMarkdown()` to understand what information is currently extracted (and what's lost). The new generator must extract EVERYTHING planExporter extracts PLUS the graph/critique data.
  - `apps/desktop/src/stores/ideaMazeStore.ts` — How moodboard state is structured in the store. The generator receives this data shape.

  **API/Type References**:
  - Task 1's `PRDDocument`, `DependencyEdge`, `Contradiction`, `ScopeExclusion`, `AcceptanceCriterion` from `lib/context/types.ts`

  **Acceptance Criteria**:
  - [ ] `bun test apps/desktop/src/lib/context/__tests__/prdGenerator.test.ts` → PASS (8+ tests)
  - [ ] Rich maze test: PRD contains correct dependency count, contradiction count, exclusion count, criteria count
  - [ ] Empty maze test: PRD has empty arrays, no crash
  - [ ] Dismissed critiques appear in scopeExclusions (not acceptanceCriteria)
  - [ ] Undismissed critiques appear in acceptanceCriteria
  - [ ] PlanContent embedded as-is (reference equality with input)
  - [ ] Function is pure (input moodboard unchanged after call)

  **QA Scenarios:**

  ```
  Scenario: Rich maze produces complete PRD
    Tool: Bash (vitest)
    Preconditions: prdGenerator.ts with full extraction logic
    Steps:
      1. Create test moodboard: 10 nodes, 5 depends-on, 2 contradicts, 3 alternatives, 4 critiques (2 dismissed)
      2. Call generatePRD(moodboard, planNode)
      3. Assert prd.dependencyGraph.length === 5
      4. Assert prd.contradictions.length === 2
      5. Assert prd.scopeExclusions includes dismissed critiques + alternative nodes
      6. Assert prd.acceptanceCriteria.length === 2 (undismissed only)
      7. Assert prd.plan === planNode.content[0] (reference equality)
    Expected Result: All assertions pass, complete graph extracted
    Failure Indicators: Wrong counts, missing data, plan modified
    Evidence: .sisyphus/evidence/task-4-rich-maze.txt

  Scenario: Empty maze doesn't crash
    Tool: Bash (vitest)
    Preconditions: prdGenerator.ts with edge case handling
    Steps:
      1. Create moodboard with 1 plan node, 0 other nodes, 0 connections
      2. Call generatePRD(moodboard, planNode)
      3. Assert prd.dependencyGraph is empty array
      4. Assert prd.contradictions is empty array
      5. Assert prd.plan.summary exists
    Expected Result: Valid PRD with empty arrays, no crash
    Failure Indicators: Exception, null reference, undefined fields
    Evidence: .sisyphus/evidence/task-4-empty-maze.txt
  ```

  **Commit**: YES (standalone)
  - Message: `feat(context): add PRD generator from maze topology`
  - Files: `lib/context/prdGenerator.ts`, tests
  - Pre-commit: `bun test apps/desktop/src/lib/context/`

- [ ] 5. PRD Auto-Generation on Plan Creation

  **What to do**:
  - Modify `apps/desktop/src/hooks/useIdeaMazeChat.ts` — in the interview completion handler (where ````plan` block is parsed and PlanContent node created):
    - After creating the plan node, call `generatePRD()` with current moodboard + new plan node
    - Call `savePRDToAppData(moodboardId, prd)` to persist
    - Show toast: `showToast({ message: 'PRD generated from your plan', type: 'success', undoCallback: () => deletePRD(moodboardId) })`
  - Add `currentPRD: PRDDocument | null` field to ideaMazeStore (or create a new prdStore)
  - When moodboard loads and has a saved PRD, load it into store
  - Wire up the "Build This" button to use the PRD (prepare for Task 8's handoff change)
  - Write TDD tests: mock interview completion, verify PRD generated, verify PRD saved, verify toast fired

  **Must NOT do**:
  - Must NOT fire during AI processing (`isAIProcessing` check)
  - Must NOT generate PRD if no plan node exists in moodboard
  - Must NOT block the UI during PRD generation (async)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Integration task connecting useIdeaMazeChat hook with new context system. Needs understanding of existing interview flow.

  **Parallelization**:
  - **Can Run In Parallel**: YES (within Wave 2, after Task 4)
  - **Parallel Group**: Wave 2 (with Task 6)
  - **Blocks**: Tasks 10, 11
  - **Blocked By**: Tasks 1, 3, 4

  **References**:

  **Pattern References**:
  - `apps/desktop/src/hooks/useIdeaMazeChat.ts` — The interview system. Look for where ````plan` parsing happens and `PlanContent` is created. That's the insertion point.
  - `apps/desktop/src/stores/ideaMazeStore.ts` — Moodboard state management. Follow existing patterns for adding new state fields.
  - `apps/desktop/src/lib/ideaMaze/storage.ts:saveMoodboard()` — The debounced save pattern to follow for PRD saves.

  **API/Type References**:
  - Task 1: `PRDDocument` from `lib/context/types.ts`
  - Task 3: `savePRDToAppData`, `loadPRDFromAppData` from `lib/context/prdStorage.ts`
  - Task 4: `generatePRD` from `lib/context/prdGenerator.ts`

  **Acceptance Criteria**:
  - [ ] After interview completion, PRD is generated and saved
  - [ ] `currentPRD` in store is populated after plan creation
  - [ ] PRD loads from storage when moodboard is opened
  - [ ] Toast notification fires on PRD generation
  - [ ] PRD is NOT generated if `isAIProcessing` is true when manually triggered

  **QA Scenarios:**

  ```
  Scenario: Interview completion triggers PRD generation
    Tool: Bash (vitest)
    Preconditions: useIdeaMazeChat modified, generator + storage mocked
    Steps:
      1. Mock interview completion (simulate ```plan block parsing)
      2. Assert generatePRD was called with current moodboard + new plan node
      3. Assert savePRDToAppData was called with moodboard ID + generated PRD
      4. Assert showToast was called with success message
    Expected Result: Full chain fires: interview complete → generate → save → toast
    Failure Indicators: Chain broken at any step, no toast, PRD not saved
    Evidence: .sisyphus/evidence/task-5-interview-triggers-prd.txt
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `feat(ideaMaze): auto-generate and regenerate PRD from plan`
  - Files: `hooks/useIdeaMazeChat.ts`, `stores/ideaMazeStore.ts`, tests
  - Pre-commit: `bun test apps/desktop/src/hooks/ && bun test apps/desktop/src/lib/context/`

- [ ] 6. PRD Auto-Regeneration on Maze Changes

  **What to do**:
  - Add change detection in `ideaMazeStore.ts` for significant maze modifications:
    - Significant: node added/removed, connection added/removed, plan content edited, critique accepted/dismissed
    - NOT significant: node position change, node resize, viewport change, selection change
  - When significant change detected AND a PRD already exists for this moodboard:
    - Debounce 2 seconds (don't regenerate on every keystroke)
    - Call `generatePRD()` with updated moodboard state
    - Save updated PRD via `savePRDToAppData()`
    - Show toast: `'PRD updated'` with undo (restores previous PRD)
  - Skip regeneration if `isAIProcessing` is true
  - Write TDD tests: test significant vs insignificant change detection, test debounce behavior, test undo restores previous PRD

  **Must NOT do**:
  - Must NOT regenerate on position/viewport/selection changes
  - Must NOT regenerate if no PRD exists yet (that's Task 5's job)
  - Must NOT regenerate during AI processing
  - Must NOT block UI during regeneration

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Requires careful change detection logic and debounce handling. Integration with existing store subscriptions.

  **Parallelization**:
  - **Can Run In Parallel**: YES (within Wave 2, after Task 4)
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Tasks 10, 11
  - **Blocked By**: Tasks 1, 3, 4

  **References**:

  **Pattern References**:
  - `apps/desktop/src/stores/ideaMazeStore.ts` — Study existing `subscribeWithSelector` patterns. The store already has change tracking for auto-save. Follow the same debounce pattern (currently 1s for moodboard save).
  - `apps/desktop/src/lib/ideaMaze/storage.ts` — Debounced save implementation to mirror.

  **Acceptance Criteria**:
  - [ ] Adding a node triggers PRD regeneration (after debounce)
  - [ ] Moving a node does NOT trigger PRD regeneration
  - [ ] Regeneration debounces at 2 seconds
  - [ ] Undo in toast restores previous PRD version
  - [ ] No regeneration during AI processing
  - [ ] No regeneration if no PRD exists

  **QA Scenarios:**

  ```
  Scenario: Significant change triggers debounced regeneration
    Tool: Bash (vitest)
    Preconditions: ideaMazeStore with change detection, PRD exists
    Steps:
      1. Set up store with existing PRD
      2. Add a node (significant change)
      3. Assert generatePRD NOT called immediately
      4. Wait 2100ms
      5. Assert generatePRD called once
    Expected Result: Debounced regeneration after 2s
    Failure Indicators: Immediate call, no call after timeout, multiple calls
    Evidence: .sisyphus/evidence/task-6-debounced-regen.txt

  Scenario: Insignificant changes do NOT trigger regeneration
    Tool: Bash (vitest)
    Preconditions: Store with PRD, change detection active
    Steps:
      1. Move a node (position change only)
      2. Resize a node
      3. Change viewport zoom
      4. Wait 3000ms
      5. Assert generatePRD was NOT called
    Expected Result: Zero regeneration calls
    Failure Indicators: Any regeneration triggered
    Evidence: .sisyphus/evidence/task-6-insignificant-no-regen.txt
  ```

  **Commit**: YES (groups with Task 5)
  - Message: `feat(ideaMaze): auto-generate and regenerate PRD from plan`
  - Files: `stores/ideaMazeStore.ts`, tests
  - Pre-commit: `bun test apps/desktop/src/stores/`

- [ ] 7. PRD Sidebar Card in Build Tab

  **What to do**:
  - Activate and evolve the orphaned `apps/desktop/src/components/layout/PlanReferenceCard.tsx`
  - Move/rename to `apps/desktop/src/components/build/PrdCard.tsx`
  - Redesign to show structured PRD data (not just PlanContent): summary section, expandable requirements list, dependency graph summary ("5 dependencies, 2 contradictions"), scope exclusions section, acceptance criteria checklist
  - Integrate into `IDEPage.tsx` as a collapsible pinned card in the sidebar area
  - Card should show when workspace has a PRD (`currentPRD` in store or loaded from workspace)
  - Card should be collapsible/expandable (collapsed by default to not disrupt chat)
  - Write TDD tests: test renders with PRD data, test renders nothing when no PRD, test expand/collapse, test all sections present

  **Must NOT do**:
  - Must NOT break existing Build tab chat layout (ChatArea scroll must still work)
  - Must NOT make the card non-dismissible (user can collapse/hide it)
  - Must NOT add editing capabilities to the card (read-only reference)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`ui-styling`]
    - `ui-styling`: UI component with TailwindCSS styling, collapsible sections, visual hierarchy

  **Parallelization**:
  - **Can Run In Parallel**: YES (within Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 10)
  - **Blocks**: Task 11
  - **Blocked By**: Task 1 (needs PRDDocument type)

  **References**:

  **Pattern References**:
  - `apps/desktop/src/components/layout/PlanReferenceCard.tsx` — The orphaned component. Already takes `PlanContent` as prop and renders expandable card. EVOLVE this (don't start from scratch) to handle `PRDDocument` instead.
  - `apps/desktop/src/pages/IDEPage.tsx` — The Build tab layout. Understand how chat panel, editor, and preview are arranged. The PRD card should integrate into the sidebar without disrupting the layout.
  - `apps/desktop/src/components/ideaMaze/IdeaMazeSidebar.tsx` — Sidebar pattern with tabs and collapsible sections. Follow the same UX patterns for consistency.

  **Acceptance Criteria**:
  - [ ] `PrdCard.tsx` exists and renders PRDDocument data
  - [ ] Card shows in Build tab when workspace has PRD
  - [ ] Card does NOT show when no PRD exists
  - [ ] Card is collapsible/expandable
  - [ ] Chat layout unaffected (ChatArea scroll works)
  - [ ] All PRD sections visible: summary, requirements, dependencies, contradictions, exclusions, acceptance criteria

  **QA Scenarios:**

  ```
  Scenario: PRD card renders with full data
    Tool: Bash (vitest) + Playwright
    Preconditions: PrdCard component created, test PRDDocument data
    Steps:
      1. Render PrdCard with test PRDDocument containing 3 requirements, 2 dependencies, 1 contradiction
      2. Assert summary text visible
      3. Assert "3 requirements" or individual requirement items visible
      4. Assert "2 dependencies" mentioned
      5. Assert "1 contradiction" flagged
    Expected Result: All sections render correctly
    Failure Indicators: Missing sections, wrong data, layout broken
    Evidence: .sisyphus/evidence/task-7-prd-card-render.png

  Scenario: No PRD = no card
    Tool: Bash (vitest)
    Preconditions: PrdCard component
    Steps:
      1. Render PrdCard with undefined/null PRD
      2. Assert component returns null or empty
    Expected Result: Nothing rendered, no crash
    Evidence: .sisyphus/evidence/task-7-no-prd-no-card.txt
  ```

  **Commit**: YES (standalone)
  - Message: `feat(build): add pinned PRD card in Build tab sidebar`
  - Files: `components/build/PrdCard.tsx`, `pages/IDEPage.tsx`, remove orphaned `PlanReferenceCard.tsx`, tests
  - Pre-commit: `bun run --cwd apps/desktop tsc --noEmit`

- [ ] 8. Replace Markdown Handoff with Structured PRD

  **What to do**:
  - Modify `apps/desktop/src/stores/repositoryStore.ts` — `buildFromPlan()` function:
    - Instead of calling `formatPlanAsMarkdown()` and seeding chat with markdown string...
    - Call `copyPRDToWorkspace(prd, workspace.localPath)` to write PRD to `{workspace}/.hatch/context/prd.json`
    - Set `workspace.sourcePRD` reference (or store PRD ID) for the Build tab to pick up
    - Still switch to Build tab / BYOA mode
  - Remove or deprecate `apps/desktop/src/lib/ideaMaze/planExporter.ts` (the markdown formatter)
  - Modify the initial chat seeding: instead of a markdown message, send a structured summary ("PRD loaded with N requirements, N dependencies. Type 'start building' to begin.")
  - Ensure existing E2E tests in `build-from-plan.spec.ts` are updated to verify new flow
  - Write TDD tests: test buildFromPlan creates workspace + writes PRD, test PRD file exists at correct path, test old markdown message is NOT sent

  **Must NOT do**:
  - Must NOT break the workspace creation flow (git worktree creation must still work)
  - Must NOT remove buildFromPlan() entirely (modify it)
  - Must NOT use plugin-fs for workspace writes (use invoke() IPC)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - Reason: Modifying a critical flow (buildFromPlan) that involves Tauri IPC, store integration, and E2E test updates. High risk of regressions.

  **Parallelization**:
  - **Can Run In Parallel**: Partially (with Tasks 7, 10 in Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 9, 11
  - **Blocked By**: Tasks 1, 3, 4, 5

  **References**:

  **Pattern References**:
  - `apps/desktop/src/stores/repositoryStore.ts:buildFromPlan()` — THE function to modify. Study it line by line. Understand workspace creation, git worktree setup, plan seeding.
  - `apps/desktop/src/lib/ideaMaze/planExporter.ts:formatPlanAsMarkdown()` — The function being REMOVED/DEPRECATED. Understand what it does so the replacement provides equivalent (or better) information.
  - `apps/desktop/src/stores/chatStore.ts:addMessage()` — How messages are added to chat. The initial seeding changes here.

  **Test References**:
  - `testing/e2e/tests/build-from-plan.spec.ts` — The 6 E2E tests that MUST continue to pass. These verify the full build-from-plan flow. Update them for the new behavior (PRD file instead of markdown message). Read this file FIRST before making changes.

  **Acceptance Criteria**:
  - [ ] buildFromPlan() writes PRD to `{workspace}/.hatch/context/prd.json`
  - [ ] Old markdown seeding (`formatPlanAsMarkdown`) is removed or deprecated
  - [ ] Chat receives structured summary message (not raw PRD/markdown)
  - [ ] All 6 existing build-from-plan E2E tests pass (updated for new flow)
  - [ ] Workspace creation (git worktree) still works correctly
  - [ ] `planExporter.ts` is removed or clearly marked deprecated

  **QA Scenarios:**

  ```
  Scenario: Build from plan creates PRD file in workspace
    Tool: Bash (vitest / integration test)
    Preconditions: Modified buildFromPlan(), mocked Tauri invoke
    Steps:
      1. Call buildFromPlan() with test moodboard + plan
      2. Assert invoke('write_project_files') was called with path containing '.hatch/context/prd.json'
      3. Assert the written content is valid JSON matching PRDDocument schema
      4. Assert chat message is a structured summary (not raw markdown)
    Expected Result: PRD file created, structured message sent
    Failure Indicators: Markdown message, no PRD file, invoke not called
    Evidence: .sisyphus/evidence/task-8-build-creates-prd.txt

  Scenario: Existing E2E tests pass
    Tool: Playwright
    Preconditions: All changes complete
    Steps:
      1. Run `pnpm test:critical-flows`
      2. Check build-from-plan suite specifically
    Expected Result: All E2E tests pass including build-from-plan suite
    Failure Indicators: Any E2E failure
    Evidence: .sisyphus/evidence/task-8-e2e-pass.txt
  ```

  **Commit**: YES (groups with Task 9)
  - Message: `feat(build): replace markdown handoff with structured PRD`
  - Files: `stores/repositoryStore.ts`, `stores/chatStore.ts`, `lib/ideaMaze/planExporter.ts` (remove/deprecate), E2E test updates
  - Pre-commit: `bun run --cwd apps/desktop tsc --noEmit && pnpm test:critical-flows`

- [ ] 9. Build Agent Context Injection

  **What to do**:
  - Modify `apps/desktop/src/hooks/useChat.ts` — use the existing `readProjectMemory` placeholder to load PRD from workspace
  - When Build session starts on a workspace with PRD: read `.hatch/context/prd.json`, serialize as structured context for the agent
  - Inject PRD as system context (not a user message): format it as a structured block the agent receives before the conversation starts
  - Format for the agent should include: summary, numbered requirements, dependency ordering notes, contradictions to resolve, scope exclusions ("Do NOT build these"), acceptance criteria to verify against
  - Write TDD tests: test PRD loading from workspace, test context injection format, test graceful handling when no PRD exists, test agent receives structured context

  **Must NOT do**:
  - Must NOT dump raw JSON into the agent prompt (format it as readable structured text)
  - Must NOT make PRD the ONLY context (it supplements existing project memory)
  - Must NOT modify the agent adapter interface (the PRD is formatted into the message stream)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Involves understanding the agent bridge (Claude Code CLI) and how context is passed to the LLM.

  **Parallelization**:
  - **Can Run In Parallel**: Partially (depends on Task 8)
  - **Parallel Group**: Wave 3 (after Task 8)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 1, 3, 8

  **References**:

  **Pattern References**:
  - `apps/desktop/src/hooks/useChat.ts:readProjectMemory()` — The existing placeholder. It reads `.hatch/context.md` via invoke(). Extend this to also read `.hatch/context/prd.json`.
  - `apps/desktop/src/hooks/useChat.ts` — Look for where system prompt or initial context is assembled before sending to the agent. That's where PRD context gets injected.
  - `apps/desktop/src/lib/claudeCode/bridge.ts` — How messages flow to Claude Code CLI. Understand the message format.

  **Acceptance Criteria**:
  - [ ] Agent receives structured PRD context when workspace has PRD
  - [ ] Agent receives normal context when workspace has NO PRD (graceful fallback)
  - [ ] PRD context includes: summary, requirements, dependencies, contradictions, exclusions
  - [ ] Context is human-readable structured text (not raw JSON)
  - [ ] Existing chat functionality unaffected

  **QA Scenarios:**

  ```
  Scenario: Agent receives PRD context
    Tool: Bash (vitest)
    Preconditions: useChat modified, workspace with PRD
    Steps:
      1. Mock workspace with .hatch/context/prd.json
      2. Initialize chat session
      3. Capture the context/system message sent to agent
      4. Assert it contains PRD summary text
      5. Assert it contains numbered requirements
      6. Assert it contains "Do NOT build" section with exclusions
    Expected Result: Agent receives structured PRD context
    Failure Indicators: Raw JSON, missing sections, no PRD context
    Evidence: .sisyphus/evidence/task-9-agent-context.txt

  Scenario: No PRD = normal behavior
    Tool: Bash (vitest)
    Preconditions: useChat modified, workspace WITHOUT PRD
    Steps:
      1. Mock workspace without .hatch/context/prd.json
      2. Initialize chat session
      3. Assert chat works normally without errors
    Expected Result: Normal chat, no crash, no PRD reference
    Evidence: .sisyphus/evidence/task-9-no-prd-fallback.txt
  ```

  **Commit**: YES (groups with Task 8)
  - Message: `feat(build): replace markdown handoff with structured PRD`
  - Files: `hooks/useChat.ts`, tests
  - Pre-commit: `bun test apps/desktop/src/hooks/`

- [ ] 10. "Memory Updated" Toast Integration

  **What to do**:
  - Wire toast notifications from Task 2 to PRD events from Tasks 5 and 6:
    - PRD generated (Task 5): `showToast({ message: 'PRD generated: N requirements, N dependencies', type: 'success', undoCallback: deletePRD })`
    - PRD regenerated (Task 6): `showToast({ message: 'PRD updated: [change summary]', type: 'info', undoCallback: restorePreviousPRD })`
  - Undo on generation: deletes the PRD file and clears store
  - Undo on regeneration: restores the previous PRD version from memory
  - Toast message should be concise but informative: include counts (requirements, dependencies)
  - Write TDD tests: verify toast content matches PRD state, verify undo fires correctly

  **Must NOT do**:
  - Must NOT show toasts for failed PRD operations (use console.warn instead)
  - Must NOT show toasts on moodboard load (only on generation/regeneration)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Wiring existing toast system to existing PRD events. Straightforward integration.

  **Parallelization**:
  - **Can Run In Parallel**: YES (within Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 7, 8, 9)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 2, 5, 6

  **References**:

  **Pattern References**:
  - Task 2: `showToast()` from `stores/toastStore.ts`
  - Task 5: PRD generation event in `hooks/useIdeaMazeChat.ts`
  - Task 6: PRD regeneration event in `stores/ideaMazeStore.ts`

  **Acceptance Criteria**:
  - [ ] Toast appears on PRD generation with requirement/dependency counts
  - [ ] Toast appears on PRD regeneration with change summary
  - [ ] Undo on generation deletes PRD
  - [ ] Undo on regeneration restores previous PRD
  - [ ] No toast on moodboard load or failed operations

  **QA Scenarios:**

  ```
  Scenario: PRD generation shows informative toast
    Tool: Bash (vitest)
    Preconditions: Toast system + PRD generation wired
    Steps:
      1. Generate PRD from test moodboard with 5 requirements, 3 dependencies
      2. Assert toast message contains '5 requirements' and '3 dependencies'
      3. Assert toast type is 'success'
    Expected Result: Informative toast with correct counts
    Evidence: .sisyphus/evidence/task-10-generation-toast.txt
  ```

  **Commit**: YES (standalone)
  - Message: `feat(context): add Memory Updated toast notifications`
  - Files: integration wiring in hooks/stores, tests
  - Pre-commit: `bun test`

- [ ] 11. E2E Integration Test (Full Pipeline)

  **What to do**:
  - Create `testing/e2e/tests/living-prd-pipeline.spec.ts` — Full pipeline E2E test:
    1. Create moodboard with nodes and connections
    2. Run interview → create plan node
    3. Verify PRD generated (check store state or UI indicator)
    4. Click "Build This" on plan
    5. Verify workspace created with `.hatch/context/prd.json`
    6. Verify Build tab shows PRD card
    7. Verify agent context includes PRD data
  - Test edge cases:
    - Empty moodboard with only a plan node
    - Moodboard with contradictions (verify they appear in PRD card)
    - Regeneration: modify maze after PRD exists, verify PRD updates
  - Ensure ALL existing E2E tests still pass

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`playwright`]
    - `playwright`: E2E browser testing for desktop app verification

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential, depends on all previous tasks)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 12, Final wave
  - **Blocked By**: Tasks 7, 8, 9, 10

  **References**:

  **Test References**:
  - `testing/e2e/tests/build-from-plan.spec.ts` — The existing build-from-plan E2E test. Follow its structure, page objects, and fixture patterns.
  - `testing/e2e/fixtures/` — Page object models and test fixtures used by existing tests.
  - `testing/e2e/playwright.config.ts` — Playwright configuration for the project.

  **Acceptance Criteria**:
  - [ ] New E2E test file exists and all tests pass
  - [ ] Full pipeline: Maze → Plan → PRD → Build → Agent context verified
  - [ ] Edge case tests pass (empty maze, contradictions, regeneration)
  - [ ] ALL existing E2E tests still pass (`pnpm test:critical-flows`)

  **QA Scenarios:**

  ```
  Scenario: Full pipeline E2E
    Tool: Playwright
    Preconditions: Hatch desktop app running, all previous tasks complete
    Steps:
      1. Navigate to Idea Maze
      2. Create 3 nodes with text content
      3. Connect nodes (1 depends-on, 1 contradicts)
      4. Start interview, complete with test answers
      5. Verify plan node created
      6. Click 'Build This' on plan node
      7. Select repository, create workspace
      8. Verify redirect to Build tab
      9. Verify PRD card visible in sidebar
      10. Verify PRD card shows correct requirement count
    Expected Result: Full pipeline works end-to-end
    Failure Indicators: Any step fails, PRD card missing, wrong data
    Evidence: .sisyphus/evidence/task-11-full-pipeline.png
  ```

  **Commit**: YES (groups with Task 12)
  - Message: `test(e2e): add Living PRD pipeline integration tests`
  - Files: `testing/e2e/tests/living-prd-pipeline.spec.ts`
  - Pre-commit: `pnpm test:critical-flows`

- [ ] 12. Backward Compatibility + Cleanup

  **What to do**:
  - Verify all existing workspaces with `sourcePlan` still function (graceful fallback if no PRD file)
  - Remove or deprecate `planExporter.ts` if not already done in Task 8
  - Clean up any orphaned imports or references to the old markdown handoff
  - Remove orphaned `PlanReferenceCard.tsx` from `components/layout/` (replaced by `PrdCard.tsx` in Task 7)
  - Update any documentation or comments referencing the old flow
  - Run full test suite to verify zero regressions
  - Run linter and typecheck to ensure clean state

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Cleanup and verification task requiring careful attention to regression risk.

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after Task 11)
  - **Parallel Group**: Wave 4 (after Task 11)
  - **Blocks**: Final wave
  - **Blocked By**: Task 11

  **Acceptance Criteria**:
  - [ ] `bun run --cwd apps/desktop tsc --noEmit` → exit 0
  - [ ] `pnpm lint` → exit 0 (no lint errors)
  - [ ] `pnpm test` → all pass
  - [ ] `pnpm test:critical-flows` → all pass
  - [ ] No orphaned imports (search for planExporter, PlanReferenceCard)
  - [ ] Old workspaces without PRD still function (Build tab works, just no PRD card)

  **QA Scenarios:**

  ```
  Scenario: Full clean build
    Tool: Bash
    Preconditions: All tasks complete
    Steps:
      1. Run `bun run --cwd apps/desktop tsc --noEmit`
      2. Run `pnpm lint`
      3. Run `pnpm test`
      4. Run `pnpm test:critical-flows`
    Expected Result: All commands exit 0
    Failure Indicators: Any non-zero exit code
    Evidence: .sisyphus/evidence/task-12-clean-build.txt

  Scenario: Old workspace backward compatibility
    Tool: Bash (vitest)
    Preconditions: Workspace created before this feature (no PRD file)
    Steps:
      1. Open Build tab with workspace that has sourcePlan but no .hatch/context/prd.json
      2. Assert Build tab loads without crash
      3. Assert PRD card is NOT shown (graceful absence)
      4. Assert chat works normally
    Expected Result: Old workspaces work, just without PRD features
    Evidence: .sisyphus/evidence/task-12-backward-compat.txt
  ```

  **Commit**: YES (groups with Task 11)
  - Message: `test(e2e): add Living PRD pipeline integration tests`
  - Files: cleanup files, removed orphans
  - Pre-commit: `pnpm ci`

---
## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
      Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
      Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (PRD generation → Build handoff → agent context). Test edge cases: empty moodboard, multiple plans, large moodboards. Save to `.sisyphus/evidence/final-qa/`.
      Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
      For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
      Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task(s) | Message                                                      | Files                                                         |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 1             | `feat(context): add PRDDocument type system`                 | `lib/context/types.ts`, `lib/context/__tests__/types.test.ts` |
| 2             | `feat(ui): add reusable toast notification system`           | `stores/toastStore.ts`, `components/ui/Toast.tsx`, tests      |
| 3             | `feat(context): add PRD two-phase storage service`           | `lib/context/prdStorage.ts`, tests                            |
| 4             | `feat(context): add PRD generator from maze topology`        | `lib/context/prdGenerator.ts`, tests                          |
| 5, 6          | `feat(ideaMaze): auto-generate and regenerate PRD from plan` | `hooks/useIdeaMazeChat.ts`, `stores/ideaMazeStore.ts`, tests  |
| 7             | `feat(build): add pinned PRD card in Build tab sidebar`      | `components/build/PrdCard.tsx`, `pages/IDEPage.tsx`, tests    |
| 8, 9          | `feat(build): replace markdown handoff with structured PRD`  | `stores/repositoryStore.ts`, `hooks/useChat.ts`, tests        |
| 10            | `feat(context): add Memory Updated toast notifications`      | integration wiring, tests                                     |
| 11, 12        | `test(e2e): add Living PRD pipeline integration tests`       | `testing/e2e/`, cleanup                                       |

---

## Success Criteria

### Verification Commands

```bash
# Type safety
bun run --cwd apps/desktop tsc --noEmit        # Expected: exit 0

# All unit tests pass
bun test                                          # Expected: all pass

# Existing E2E tests still pass
pnpm test:critical-flows                          # Expected: all 5 suites pass

# New PRD-specific tests pass
bun test apps/desktop/src/lib/context/            # Expected: all pass
```

### Final Checklist

- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (unit + E2E)
- [ ] PlanContent type is UNCHANGED
- [ ] Existing buildFromPlan E2E tests pass
- [ ] Full pipeline works: Maze → PRD → Build → Agent receives structured context
- [ ] Toast notification appears with undo on PRD generation
