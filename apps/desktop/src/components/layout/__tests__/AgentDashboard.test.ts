// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  formatElapsedTime,
  getAgentStatusLabel,
  getAgentStatusColor,
  buildAgentRow,
} from '../AgentDashboard'
import type { ManagedAgentProcess } from '../../../lib/agents/processManager'
import type { Workspace, WorkspaceStatus } from '../../../stores/repositoryStore'

// ─── Test Helpers ──────────────────────────────────────────────────────

function makeProcess(overrides: Partial<ManagedAgentProcess> = {}): ManagedAgentProcess {
  return {
    id: 'proc-1',
    workspaceId: 'ws-1',
    worktreePath: '/tmp/ws-1',
    agentType: 'claude-code',
    pid: 4242,
    status: 'idle',
    startedAt: Date.now() - 60_000,
    lastActivityAt: Date.now(),
    ...overrides,
  }
}

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    repositoryId: 'repo-1',
    branchName: 'workspace/feature-auth',
    localPath: '/tmp/ws-1',
    repoPath: '/tmp/repo',
    status: 'idle',
    lastActive: new Date(),
    agentId: 'claude-code',
    workspaceStatus: 'in-progress' as WorkspaceStatus,
    ...overrides,
  }
}

// ─── formatElapsedTime ────────────────────────────────────────────────

describe('formatElapsedTime', () => {
  it('returns "Just now" for less than 60 seconds', () => {
    expect(formatElapsedTime(Date.now() - 30_000)).toBe('Just now')
  })

  it('returns minutes for 1-59 minutes', () => {
    expect(formatElapsedTime(Date.now() - 5 * 60_000)).toBe('5m')
  })

  it('returns hours for 1-23 hours', () => {
    expect(formatElapsedTime(Date.now() - 3 * 3600_000)).toBe('3h')
  })

  it('returns days for 24+ hours', () => {
    expect(formatElapsedTime(Date.now() - 2 * 86400_000)).toBe('2d')
  })

  it('handles exact boundary at 60 seconds as 1m', () => {
    expect(formatElapsedTime(Date.now() - 60_000)).toBe('1m')
  })
})

// ─── getAgentStatusLabel ──────────────────────────────────────────────

describe('getAgentStatusLabel', () => {
  it('returns "Streaming" for streaming status', () => {
    expect(getAgentStatusLabel('streaming')).toBe('Streaming')
  })

  it('returns "Idle" for idle status', () => {
    expect(getAgentStatusLabel('idle')).toBe('Idle')
  })

  it('returns "Error" for error status', () => {
    expect(getAgentStatusLabel('error')).toBe('Error')
  })

  it('returns "Starting" for starting status', () => {
    expect(getAgentStatusLabel('starting')).toBe('Starting')
  })

  it('returns "Killed" for killed status', () => {
    expect(getAgentStatusLabel('killed')).toBe('Killed')
  })
})

// ─── getAgentStatusColor ─────────────────────────────────────────────

describe('getAgentStatusColor', () => {
  it('returns green class for streaming', () => {
    expect(getAgentStatusColor('streaming')).toContain('emerald')
  })

  it('returns neutral class for idle', () => {
    expect(getAgentStatusColor('idle')).toContain('neutral')
  })

  it('returns red class for error', () => {
    expect(getAgentStatusColor('error')).toContain('red')
  })

  it('returns yellow class for starting', () => {
    expect(getAgentStatusColor('starting')).toContain('amber')
  })

  it('returns neutral class for killed', () => {
    expect(getAgentStatusColor('killed')).toContain('neutral')
  })
})

// ─── buildAgentRow ───────────────────────────────────────────────────

describe('buildAgentRow', () => {
  it('combines process and workspace data into AgentRowData', () => {
    const process = makeProcess({ status: 'streaming' })
    const workspace = makeWorkspace({ branchName: 'workspace/auth-flow' })

    const row = buildAgentRow(process, workspace)

    expect(row.workspaceId).toBe('ws-1')
    expect(row.workspaceName).toBe('workspace/auth-flow')
    expect(row.agentType).toBe('claude-code')
    expect(row.status).toBe('streaming')
    expect(row.workspaceStatus).toBe('in-progress')
    expect(row.isStreaming).toBe(true)
  })

  it('sets isStreaming to false for non-streaming statuses', () => {
    const process = makeProcess({ status: 'idle' })
    const workspace = makeWorkspace()

    const row = buildAgentRow(process, workspace)

    expect(row.isStreaming).toBe(false)
  })

  it('sets isStreaming to false for error status', () => {
    const process = makeProcess({ status: 'error' })
    const workspace = makeWorkspace()

    const row = buildAgentRow(process, workspace)

    expect(row.isStreaming).toBe(false)
    expect(row.status).toBe('error')
  })

  it('uses workspace.id when process has no matching workspace name', () => {
    const process = makeProcess({ workspaceId: 'ws-abc' })
    const workspace = makeWorkspace({ id: 'ws-abc', branchName: 'feature/xyz' })

    const row = buildAgentRow(process, workspace)

    expect(row.workspaceId).toBe('ws-abc')
    expect(row.workspaceName).toBe('feature/xyz')
  })

  it('handles null workspace gracefully with fallback', () => {
    const process = makeProcess({ workspaceId: 'ws-orphan' })

    const row = buildAgentRow(process, null)

    expect(row.workspaceId).toBe('ws-orphan')
    expect(row.workspaceName).toBe('ws-orphan')
    expect(row.workspaceStatus).toBe('backlog')
  })

  it('includes elapsed time string', () => {
    const process = makeProcess({ startedAt: Date.now() - 120_000 })
    const workspace = makeWorkspace()

    const row = buildAgentRow(process, workspace)

    expect(row.elapsedTime).toBe('2m')
  })

  it('includes branchName from workspace', () => {
    const process = makeProcess()
    const workspace = makeWorkspace({ branchName: 'workspace/my-branch' })

    const row = buildAgentRow(process, workspace)

    expect(row.branchName).toBe('workspace/my-branch')
  })
})