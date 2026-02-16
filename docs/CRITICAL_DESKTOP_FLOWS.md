# Critical Desktop Flows (Hatch)

These are the hard, must-not-break journeys for Hatch desktop.

## Suite A: Idea Maze → Plan → Build
- Create/select moodboard
- Add nodes (keyboard + paste)
- Create node relationships
- Run AI actions (find connections / generate ideas / critique)
- Run interview loop and parse structured question/plan output
- Create Plan node
- Use "Build from Plan" to create workspace and route to BYOA chat

## Suite B: Agent Harness Reliability
- Workspace-level agent selection and switching
- Authentication/install guardrails for local agents
- Streaming rendering of assistant/tool events
- Stop generation behavior correctness
- Open PR helper prompt includes correct target branch/workspace context

## Suite C: Repository/Workspace Shipping
- Clone/open repository
- Create isolated workspace/worktree
- Edit + save + status refresh
- Commit + push changes
- Create pull request and store PR metadata
- Merge pull request and update workspace state

## Suite D: Fault Paths
- Agent stream interruptions
- Malformed JSON from Idea Maze AI responses
- Git push/create-PR failures
- Expired GitHub auth during shipping actions

## Initial Test File Targets
- `testing/e2e/idea-maze-plan-to-build.spec.ts`
- `testing/e2e/agent-harness-streaming.spec.ts`
- `testing/e2e/shipping-workspace-pr-flow.spec.ts`
- `testing/e2e/failure-paths.spec.ts`
