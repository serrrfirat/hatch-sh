# Quality Lockdown Mode (Active)

## Directive
No new features until:
1. every critical user flow has automated test coverage,
2. CI is consistently green.

## Scope
Desktop app only (Hatch):
- Idea Maze flows
- Design webview lifecycle
- BYOA/agent harness flows
- Repository/workspace shipping flows
- Failure-path reliability scenarios

## Rules
- TDD-only implementation (tests first).
- Test debt work is prioritized over feature work.
- Any uncovered critical flow blocks feature development.
- Any red CI blocks merge and release.

## Exit Criteria
- Critical flow matrix fully mapped to tests.
- CI passes on required gates.
- No P0/P1 quality regressions open.

## Owner
Autonomous agent loop, with CEO/CTO override by Firat.
