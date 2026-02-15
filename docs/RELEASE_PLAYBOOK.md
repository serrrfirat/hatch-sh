# Release Playbook

## Branching
- Default branch: `main`
- Feature branches: `feat/*`, `fix/*`, `chore/*`

## Pre-Release Checklist
- [ ] PR CI green
- [ ] Nightly desktop checks green (latest)
- [ ] No open P0/P1 issues
- [ ] Changelog updated
- [ ] Rollback artifact identified

## Release Steps
1. Freeze merges except release fixes.
2. Run release workflow.
3. Validate desktop smoke for packaged artifact.
4. Publish notes and version.
5. Monitor first 60 minutes for regressions.

## Rollback
- Trigger rollback if P0/P1 appears post-release.
- Revert to previous known-good artifact.
- Open incident note and add regression test before re-release.

## Ownership
- Release Operator drives checklist.
- CEO/CTO gives final ship/no-ship.
