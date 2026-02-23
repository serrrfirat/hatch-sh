// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { useChatStore, selectMessagesForWorkspace } from '../../src/stores/chatStore'
import { useRepositoryStore, type Workspace } from '../../src/stores/repositoryStore'
import { parseSlashCommand } from '../../src/lib/slashCommands'
import { calculateContextSize } from '../../src/components/chat/ContextMeter'
import { buildMentionContent } from '../../src/lib/fileMentionContent'
import { MAX_IMAGE_SIZE_BYTES, isImageFile, isImageTooLarge } from '../../src/lib/imageAttachment'
import { estimateRateUsage, getRateLimitColor } from '../../src/components/layout/RateLimitMeter'
import { AgentProcessManager, type ManagedAgentProcess } from '../../src/lib/agents/processManager'
import {
  commitChanges,
  getDiff,
  getGitStatus,
  worktreeCreate,
  worktreeList,
  worktreeRemove,
} from '../../src/lib/git/bridge'

vi.mock('zustand/middleware', () => ({
  persist: <T>(fn: T) => fn,
  devtools: <T>(fn: T) => fn,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

function createWorkspace(id: string, workspaceStatus: Workspace['workspaceStatus']): Workspace {
  return {
    id,
    repositoryId: 'repo-1',
    branchName: `workspace/${id}`,
    localPath: `/tmp/${id}`,
    repoPath: '/tmp/repo-1',
    status: 'idle',
    lastActive: new Date('2026-01-01T00:00:00.000Z'),
    agentId: 'claude-code',
    workspaceStatus,
  }
}

function searchWorkspaceMessages(
  workspaceId: string,
  query: string
): Array<{ id: string; content: string }> {
  const messages = selectMessagesForWorkspace(useChatStore.getState(), workspaceId)
  const lower = query.toLowerCase()
  return messages
    .filter((message) => message.content.toLowerCase().includes(lower))
    .map((message) => ({ id: message.id, content: message.content }))
}

describe('feature parity integration (T1-T17)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useChatStore.setState({
      messagesByWorkspace: {},
      activeStreamingWorkspaces: new Set<string>(),
      loadingByWorkspace: {},
      currentWorkspaceId: null,
      isLoading: false,
      currentProjectId: null,
      pendingOpenPR: null,
      contextWindowSize: 20,
    })

    useRepositoryStore.setState({
      githubAuth: null,
      isAuthenticating: false,
      authError: null,
      isGhInstalled: null,
      repositories: [],
      currentRepository: null,
      workspaces: [],
      currentWorkspace: null,
      isCloning: false,
      cloneProgress: null,
      notifications: [],
    })
  })

  it('workspace status lifecycle transitions backlog -> in-progress -> done on archive flow', async () => {
    const workspace = createWorkspace('ws-lifecycle', 'backlog')
    useRepositoryStore.setState({
      repositories: [
        {
          id: 'repo-1',
          name: 'repo-1',
          full_name: 'owner/repo-1',
          clone_url: 'https://github.com/owner/repo-1.git',
          local_path: '/tmp/repo-1',
          default_branch: 'main',
          is_private: false,
        },
      ],
      workspaces: [workspace],
      currentWorkspace: workspace,
    })

    useChatStore.getState().setWorkspaceId('ws-lifecycle')
    useChatStore.getState().addMessage({ role: 'user', content: 'first message' }, 'ws-lifecycle')

    const inProgressWorkspace = useRepositoryStore
      .getState()
      .workspaces.find((item) => item.id === 'ws-lifecycle')
    expect(inProgressWorkspace?.workspaceStatus).toBe('in-progress')

    useRepositoryStore.getState().updateWorkspaceWorkflowStatus('ws-lifecycle', 'done')
    const doneWorkspace = useRepositoryStore
      .getState()
      .workspaces.find((item) => item.id === 'ws-lifecycle')
    expect(doneWorkspace?.workspaceStatus).toBe('done')

    vi.mocked(invoke).mockResolvedValueOnce(undefined)
    await useRepositoryStore.getState().removeWorkspace('ws-lifecycle')

    expect(
      useRepositoryStore.getState().workspaces.find((item) => item.id === 'ws-lifecycle')
    ).toBeUndefined()
  })

  it('slash command clear only affects targeted workspace messages', () => {
    useChatStore.getState().addMessage({ role: 'user', content: 'workspace-a-msg-1' }, 'ws-a')
    useChatStore.getState().addMessage({ role: 'assistant', content: 'workspace-a-msg-2' }, 'ws-a')
    useChatStore.getState().addMessage({ role: 'user', content: 'workspace-b-msg-1' }, 'ws-b')

    const parsed = parseSlashCommand('/clear', { isStreaming: false })
    expect(parsed).toEqual({ type: 'clear' })

    if (parsed?.type === 'clear') {
      useChatStore.getState().clearMessages('ws-a')
    }

    expect(selectMessagesForWorkspace(useChatStore.getState(), 'ws-a')).toHaveLength(0)
    expect(selectMessagesForWorkspace(useChatStore.getState(), 'ws-b')).toHaveLength(1)
    expect(selectMessagesForWorkspace(useChatStore.getState(), 'ws-b')[0]?.content).toBe(
      'workspace-b-msg-1'
    )
  })

  it('context meter size calculation updates as workspace messages grow', () => {
    const emptyBreakdown = calculateContextSize([])
    expect(emptyBreakdown.totalBytes).toBe(0)

    useChatStore.getState().addMessage({ role: 'user', content: 'hello world' }, 'ws-context')
    const firstPass = calculateContextSize(
      selectMessagesForWorkspace(useChatStore.getState(), 'ws-context')
    )

    useChatStore
      .getState()
      .addMessage(
        { role: 'assistant', content: 'acknowledged and processing this request' },
        'ws-context'
      )
    const secondPass = calculateContextSize(
      selectMessagesForWorkspace(useChatStore.getState(), 'ws-context')
    )

    expect(firstPass.totalBytes).toBeGreaterThan(0)
    expect(secondPass.totalBytes).toBeGreaterThan(firstPass.totalBytes)
    expect(secondPass.assistantBytes).toBeGreaterThan(0)
  })

  it('chat search finds matching messages across the active workspace thread', () => {
    useChatStore
      .getState()
      .addMessage({ role: 'user', content: 'Ship the integration test plan today' }, 'ws-search')
    useChatStore
      .getState()
      .addMessage({ role: 'assistant', content: 'I can ship this after review' }, 'ws-search')
    useChatStore
      .getState()
      .addMessage({ role: 'user', content: 'No match in this line' }, 'ws-search')

    const matches = searchWorkspaceMessages('ws-search', 'ship')
    expect(matches).toHaveLength(2)
    expect(matches[0]?.content).toContain('Ship')
    expect(matches[1]?.content).toContain('ship')
  })

  it('file mention injection returns formatted content block for supported text files', () => {
    const result = buildMentionContent('src/main.ts', 'const answer = 42\n', 128)
    expect(result.type).toBe('content')
    expect(result.text).toContain('[File: src/main.ts]')
    expect(result.text).toContain('```ts')
    expect(result.text).toContain('const answer = 42')
  })

  it('image attachment validation enforces type and max size constraints', () => {
    expect(isImageFile('diagram.png')).toBe(true)
    expect(isImageFile('notes.md')).toBe(false)
    expect(isImageTooLarge(MAX_IMAGE_SIZE_BYTES)).toBe(false)
    expect(isImageTooLarge(MAX_IMAGE_SIZE_BYTES + 1)).toBe(true)
  })

  it('rate limit estimation scales with multiple active agents and recent messages', () => {
    const singleAgentUsage = estimateRateUsage(1, 0)
    const multiAgentUsage = estimateRateUsage(3, 4)

    expect(singleAgentUsage).toBe(17)
    expect(multiAgentUsage).toBe(68)
    expect(multiAgentUsage).toBeGreaterThan(singleAgentUsage)
    expect(getRateLimitColor(multiAgentUsage)).toBe('yellow')
  })

  it('agent process manager supports spawn/kill lifecycle and enforces max cap', async () => {
    const invokeMock = vi.mocked(invoke)
    const p1: ManagedAgentProcess = {
      id: 'proc-1',
      workspaceId: 'ws-1',
      worktreePath: '/tmp/ws-1',
      agentType: 'claude-code',
      status: 'starting',
      startedAt: 1,
    }
    const p2: ManagedAgentProcess = {
      id: 'proc-2',
      workspaceId: 'ws-2',
      worktreePath: '/tmp/ws-2',
      agentType: 'opencode',
      status: 'starting',
      startedAt: 2,
    }
    const p3: ManagedAgentProcess = {
      id: 'proc-3',
      workspaceId: 'ws-3',
      worktreePath: '/tmp/ws-3',
      agentType: 'cursor',
      status: 'starting',
      startedAt: 3,
    }

    invokeMock
      .mockResolvedValueOnce(p1)
      .mockResolvedValueOnce(p2)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(p3)

    const manager = new AgentProcessManager(2)
    await manager.spawn('ws-1', 'claude-code', '/tmp/ws-1')
    await manager.spawn('ws-2', 'opencode', '/tmp/ws-2')

    await expect(manager.spawn('ws-4', 'claude-code', '/tmp/ws-4')).rejects.toThrow(
      'Maximum concurrent agents reached (2)'
    )

    await manager.kill('ws-1')
    await manager.spawn('ws-3', 'cursor', '/tmp/ws-3')

    expect(manager.list().map((item) => item.workspaceId)).toEqual(['ws-2', 'ws-3'])
  })

  it('git coordinator applies command priority ordering in enqueue requests', async () => {
    const invokeMock = vi.mocked(invoke)
    invokeMock
      .mockResolvedValueOnce('hash-1')
      .mockResolvedValueOnce('diff-1')
      .mockResolvedValueOnce({
        branch: 'main',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
      })

    await commitChanges('/tmp/repo-a', 'integration commit')
    await getDiff('/tmp/repo-a')
    await getGitStatus('/tmp/repo-a')

    const callOne = invokeMock.mock.calls[0]?.[1] as {
      request: { command: string; priority: string }
    }
    const callTwo = invokeMock.mock.calls[1]?.[1] as {
      request: { command: string; priority: string }
    }
    const callThree = invokeMock.mock.calls[2]?.[1] as {
      request: { command: string; priority: string }
    }

    expect(callOne.request.command).toBe('git_commit')
    expect(callOne.request.priority).toBe('critical')
    expect(callTwo.request.command).toBe('git_diff')
    expect(callTwo.request.priority).toBe('low')
    expect(callThree.request.command).toBe('git_status')
    expect(callThree.request.priority).toBe('normal')
  })

  it('worktree lifecycle runs create, list(locked), then remove sequence', async () => {
    const invokeMock = vi.mocked(invoke)
    invokeMock
      .mockResolvedValueOnce({
        branch_name: 'workspace/ws-wt',
        worktree_path: '/tmp/repo-1/.worktrees/ws-wt',
      })
      .mockResolvedValueOnce([
        {
          path: '/tmp/repo-1/.worktrees/ws-wt',
          branch: 'workspace/ws-wt',
          headCommit: 'abc1234',
          isLocked: true,
          lockReason: 'active-agent',
          healthStatus: 'locked' as const,
        },
      ])
      .mockResolvedValueOnce(undefined)

    await worktreeCreate('/tmp/repo-1', 'ws-wt')
    const listed = await worktreeList('/tmp/repo-1')
    await worktreeRemove('/tmp/repo-1', '/tmp/repo-1/.worktrees/ws-wt', 'workspace/ws-wt')

    expect(listed).toHaveLength(1)
    expect(listed[0]?.isLocked).toBe(true)
    expect(listed[0]?.healthStatus).toBe('locked')
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'worktree_create', {
      request: { repoRoot: '/tmp/repo-1', workspaceId: 'ws-wt' },
    })
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'worktree_list', {
      request: { repoRoot: '/tmp/repo-1' },
    })
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'worktree_remove', {
      request: {
        repoRoot: '/tmp/repo-1',
        worktreePath: '/tmp/repo-1/.worktrees/ws-wt',
        branchName: 'workspace/ws-wt',
      },
    })
  })
})
