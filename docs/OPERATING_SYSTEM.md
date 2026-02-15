# Hatch Autonomous Operating System

## Purpose
Move hatch-sh from sporadic development to a daily, agent-driven shipping loop with CEO/CTO oversight.

## Decision Rights
- **CEO/CTO (Firat):** direction, priority override, risky-change approval, ship/no-ship.
- **Agents:** execution, testing, review, release prep, documentation.

## Agent Roles
1. **Jarvis PM (Planner)**
   - Input: issues, stars/feedback, bugs, flaky tests, roadmap.
   - Output: `DAILY_PLAN.md` with top 3 tasks:
     1 feature, 1 quality debt item, 1 reliability/testing improvement.
2. **Builder**
   - Implements smallest shippable increments.
   - Keeps PRs scoped and reversible.
3. **Test Guardian**
   - Writes tests before/with changes.
   - Owns regression, flake triage, and quarantine.
4. **Reviewer**
   - Architecture/risk review and regression checks.
   - Blocks unverifiable completion claims.
5. **Release Operator**
   - Maintains `CHANGELOG_DRAFT.md`, release notes, gate checklist, rollback package.
6. **Learning Keeper**
   - Converts incidents into tests + CI guardrails.
   - Maintains `docs/INCIDENT_TO_TEST.md`.

## Daily Cadence (Dubai Time)
- **08:30** Jarvis posts `DAILY_PLAN.md`.
- **Execution Block** Builder + Test Guardian run; Reviewer gates.
- **18:00** CEO digest:
  - shipped
  - blocked
  - quality deltas
  - decisions needed (yes/no prompts)

## CEO Daily Questions
1. Priority override? (yes/no)
2. Risky change allowed? (yes/no)
3. Ship today? (yes/no)

## Rules of Engagement
- Small PRs only.
- **TDD is mandatory**: write or update failing tests first, then implement until green.
- No merge without required CI.
- Any regression requires: postmortem note + failing test + CI guardrail.
- Critical desktop journeys are hard gates.
- No feature is considered done without tests proving behavior.

## Success Metrics
- PR lead time
- Critical-path pass rate
- Flake rate
- Regression escape rate
- P0/P1 MTTR
- Crash-free desktop sessions
