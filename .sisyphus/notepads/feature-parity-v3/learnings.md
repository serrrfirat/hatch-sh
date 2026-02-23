# Learnings — feature-parity-v3

## [2026-02-23] Session ses_379acc7ebffe5s0QWVgHRWvE6Y — Orchestration start

### Key Conventions

- Stack: Tauri 2 + React 18 + Zustand + TailwindCSS + Vitest
- TDD: write failing test first, then implement
- No `as any`, `@ts-ignore`, `@ts-expect-error` in new code
- No `console.log` in production code
- No new npm deps without checking existing ones
- Commit style: ENGLISH + SEMANTIC (e.g., `feat: ...`, `chore: ...`, `fix: ...`)
- Root `.gitignore` has `build/` — use `git add -f` for files under that path if needed
- `gh` CLI authenticated as `serrrfirat`

### File Layout

- React frontend: `apps/desktop/src/`
- Rust backend: `apps/desktop/src-tauri/src/lib.rs`
- Tests: `apps/desktop/src/hooks/__tests__/` + `testing/e2e/`
- Run tests: `pnpm test` (in root or apps/desktop)
- Lint: `pnpm lint` in apps/desktop
- Build: `pnpm build:desktop`

### Wave 1 Execution Order

Due to file-level conflicts, Wave 1 is split into 3 sub-batches:

- Wave 1A (parallel): T1 console.log cleanup, T3 workspace status, T7 GitCoordinator types
- Wave 1B (parallel after 1A): T2 type safety, T6 slash commands
- Wave 1C (sequential after 1B): T4 chat search, T5 context meter (both touch ChatArea.tsx)
