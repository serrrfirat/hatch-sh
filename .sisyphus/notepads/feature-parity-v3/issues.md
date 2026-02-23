# Issues — feature-parity-v3

## [2026-02-23] Session ses_379acc7ebffe5s0QWVgHRWvE6Y — Pre-execution

### Known Pre-existing Bugs (to fix in T2)

- `src/hooks/useChat.ts:22` — `getDroppedMessages` not exported from chatWindow module
- `src/hooks/useChat.ts:171` — Parameter `m` implicitly has `any` type
- `src/stores/__tests__/authExpiredFlow.test.ts:65-121` — `pendingRetryOperation` etc. not on RepositoryState
- `src/components/Plasma.tsx:193,195` — WebGL `as any` assertions
- `src/chat/ToolUseBlock.tsx:492,493` — `tool.result!` without null guard
- `src/components/chat/MessageBubble.tsx:318` — `message.toolUses!` without null guard
- `src/lib/agents/streamUtils.ts:49,55` — `as unknown` JSON parse assertions

### Wave 1 File Conflicts (Risk)

- T1 and T2: both touch useChat.ts (T1=remove console.logs, T2=fix types at different lines) → sequential batch
- T4 and T5: both touch ChatArea.tsx (T4=add search bar, T5=add context meter) → sequential
- T2 and T6: both touch useChat.ts (T2=type fixes, T6=message interception) → sequential batch
