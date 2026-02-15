# Desktop Test Strategy (Tauri)

## Scope
Desktop app quality gates for hatch-sh (`apps/desktop`, `apps/desktop/src-tauri`).

## Test Pyramid

### 1) PR Gate (required)
- Lint + typecheck (TS + Rust where applicable)
- Unit tests (frontend + Rust core logic)
- IPC contract tests (frontend ↔ Tauri commands)
- Desktop E2E smoke on critical journeys

### 2) Nightly Gate
- macOS + Windows package/build smoke
- Launch app sanity flow
- Startup time and memory budget checks
- Flake detector (rerun failures up to 3x)

### 3) Release Gate
- Critical E2E green for 7 consecutive runs
- No open P0/P1
- Rollback-ready artifacts

## Critical Desktop Journeys (v1)
1. App boot to ready state
2. Open/create project
3. Edit file and save
4. Git status refresh + stage/commit flow
5. Settings persist after restart

## Coverage Policy
- Enforce thresholds on critical modules, not vanity global coverage.
- New bug fix must include regression test.

## Flaky Test Policy
- Auto-classify flaky when pass after rerun and non-deterministic.
- Quarantine flaky tests with owner and expiry date.
- Flake rate tracked in nightly summary.

## Suggested Test Layout
- `testing/contracts/` IPC contracts
- `testing/e2e/` desktop journey tests
- `testing/fixtures/` project/repo fixtures

## Exit Criteria for “Stable Desktop”
- 14 days with no P0 regressions
- <2% flaky critical tests
- ≥95% pass rate on critical journey suite
