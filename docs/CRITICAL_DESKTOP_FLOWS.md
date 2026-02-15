# Critical Desktop Flows (Stage 3)

These are the first hard, must-not-break user journeys.

## Flow 1: App Boot
- Launch desktop app
- Reach ready/interactive state without crash

## Flow 2: Open or Create Project
- Open existing project OR create one
- Project tree renders and is navigable

## Flow 3: Edit + Save File
- Open file in editor
- Modify content
- Save and verify persisted content

## Flow 4: Git Status + Stage/Commit
- Refresh git status
- Stage at least one file
- Create commit successfully

## Flow 5: Settings Persistence
- Change a setting
- Restart app
- Confirm setting persists

## Test Mapping (initial)
- `testing/e2e/boot.spec.ts`
- `testing/e2e/project-open-create.spec.ts`
- `testing/e2e/edit-save.spec.ts`
- `testing/e2e/git-stage-commit.spec.ts`
- `testing/e2e/settings-persist.spec.ts`
