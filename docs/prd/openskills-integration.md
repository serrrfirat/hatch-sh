# PRD: OpenSkills integration (OpenSkills by Numman Ali)

Date: 2026-01-19
Owner: Firat

## Summary
Integrate the OpenSkills CLI (`numman-ali/openskills`) into Hatch Desktop so users can install, update, remove, and discover Claude-style `SKILL.md` skills from GitHub (repo slug or git URL), globally, and make them available to any Hatch agent.

## Problem
Today, Hatch users often need to manually install skills outside the app, and Hatch’s skill discovery primarily assumes `.claude/skills` paths. This creates friction and prevents a universal “skills work everywhere” experience across agents.

## Goals
- Install skills from GitHub sources using OpenSkills.
- Default to global + universal install so skills work across agents.
- Auto-sync a global `AGENTS.md` for agent consumption.
- Make installed skills visible/selectable in Hatch (mentions/picker).
- Support update/remove flows.

## Non-goals
- Building a separate marketplace API. (OpenSkills uses GitHub/git/local as the marketplace.)
- Web-only installation (desktop/Tauri remains the execution environment for now).
- Remote execution / server-side installs.

## Target user
Hatch user who wants to quickly install skills once and use them across all Hatch agents and workspaces.

## Decisions (locked)
- Install scope default: **Global**
- Install location: **`~/.agent/skills`** (OpenSkills `--global --universal`)
- Source types for MVP: **GitHub slug + Git URL**
- Sync mode: **Auto-sync after install/update/remove**
- `AGENTS.md` target: **`~/.agent/AGENTS.md`**
- MVP includes: **install + sync + visible + update/remove**

## UX / Flows
### Install (Desktop)
1. User clicks Install on a marketplace skill.
2. Hatch runs: `npx -y openskills install -y <source> --global --universal`.
3. Hatch runs: `npx -y openskills sync -y -o ~/.agent/AGENTS.md`.
4. Hatch refreshes skills list in the picker/mentions.

### Update
1. User triggers update (global or per-skill).
2. Hatch runs OpenSkills update.
3. Hatch syncs `~/.agent/AGENTS.md`.

### Remove
1. User triggers removal.
2. Hatch runs OpenSkills remove.
3. Hatch syncs `~/.agent/AGENTS.md`.

## Technical plan
- Desktop (TypeScript):
  - Add an OpenSkills-backed install path for non-aitmpl skills.
  - Add OpenSkills update/remove helpers.
  - Update UI copy and install destination hints to `.agent/skills`.
- Desktop (Tauri/Rust):
  - Reuse the existing `run_shell_command` to execute `npx openskills …`.
- Skills discovery:
  - Extend skill discovery to include `~/.agent/skills` and `<workspace>/.agent/skills`.

## Success metrics
- A user can install a skill from GitHub in one click.
- Installed skills appear in Hatch’s skills mention UI.
- `~/.agent/AGENTS.md` is updated automatically.

## Risks / mitigations
- **Conflicts with Claude Code plugins**: mitigated by using `~/.agent/skills` instead of `~/.claude/skills`.
- **Command execution reliability**: surface stdout/stderr clearly in the UI.
- **Large repos installing many skills**: acceptable for MVP; later add subpath selection.

## Milestones
1. PRD merged/approved.
2. Desktop installs via OpenSkills + auto-sync.
3. Mention/picker reads `.agent/skills`.
4. Update/remove wired.
5. Smoke test install/list/remove.

## Acceptance criteria
- Install button installs via OpenSkills, targeting `~/.agent/skills`.
- After install/update/remove, `~/.agent/AGENTS.md` is generated/updated.
- Hatch mentions/picker shows skills from `~/.agent/skills`.
- Update/remove work for a named skill.
