# Decisions — feature-parity-v3

## [2026-02-23] Session ses_379acc7ebffe5s0QWVgHRWvE6Y

### Architecture Decisions

- Workspace status = manually set field (NOT computed from git state)
- Max concurrent agents = 3 (hard cap at 5 in settings)
- GitCoordinator = serialized queue per repo root (concurrency=1)
- Worktree model = one workspace → one worktree → one CLI process (Conductor pattern)
- No inter-agent communication (agents are autonomous)
- Chat search scope = current workspace only (not cross-workspace)
- Rate limit strategy = visual warning meter + queue-and-retry (no hard blocking)
- Image storage = workspace .context/ directory (not localStorage)
- Slash commands v1 = built-in only (/clear, /review, /restart, /help)
- /clear BLOCKED while agent is streaming (race condition guard)
