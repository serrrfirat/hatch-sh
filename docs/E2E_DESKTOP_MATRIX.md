# Hatch Desktop E2E Matrix (Tauri-first)

This matrix defines the high-confidence desktop flows that must remain stable as we ship daily changes.

## PR-Blocking Coverage (implemented)

1. **App shell boot + onboarding baseline**
   - Build/Design/Idea Maze/Skills tabs render
   - Empty-state onboarding is reachable (no workspace selected + add/open actions)
   - Spec: `testing/e2e/app-shell.spec.ts`

2. **Design mode switch safety**
   - Switching to Design mode does not break shell/top nav
   - Spec: `testing/e2e/design-mode.spec.ts`

3. **Idea Maze fallback reliability**
   - Idea Maze route is reachable
   - Non-Tauri runtime failure path (`Failed to Load` + `Retry`) is handled
   - Spec: `testing/e2e/idea-maze.spec.ts`

4. **Repository onboarding modals**
   - Clone modal opens and URL input is visible
   - Quick-start modal opens and repository-name input is visible
   - Spec: `testing/e2e/repository-onboarding.spec.ts`

5. **Skills page baseline**
   - Skills tab opens
   - Search surface is visible
   - Spec: `testing/e2e/skills-marketplace.spec.ts`

6. **Settings navigation flow**
   - Settings page opens from header
   - Chat/Git/Agents tabs are navigable
   - Critical settings/agent sections render
   - Spec: `testing/e2e/settings.spec.ts`

## Current test runner posture

- Playwright config at `testing/e2e/playwright.config.ts`
- Serial execution (`workers: 1`) for stability
- Storage reset in every test to prevent persistence bleed
- Trace/video/screenshots retained on failure

## Next user stories (in-progress backlog)

1. **Idea Maze interview → plan → Build handoff**
   - Start interview
   - handle option flow
   - generate plan output
   - Build-from-plan workspace handoff

2. **Workspace shipping flow**
   - clone/open repo
   - create workspace/worktree
   - edit/save/status/commit/push
   - create PR metadata

3. **Agent harness stream behavior**
   - streaming tool events render
   - stop generation keeps partial output
   - PR helper context validation

4. **Failure-injection regression pack**
   - stream interruption
   - malformed plan JSON
   - git push failure
   - auth expiry during shipping
   - webview lifecycle faults

## CI wiring

- PR gate: `pnpm test:critical-flows`
- Playwright browser install step included in PR workflow
- Failures block merge

