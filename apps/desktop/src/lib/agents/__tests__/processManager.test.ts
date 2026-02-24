import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import {
  AgentProcessManager,
  MAX_AGENTS_HARD_CAP,
  MAX_CONCURRENT_AGENTS,
  TAURI_AGENT_INVOKE_TIMEOUT_MS,
  type ManagedAgentProcess,
} from '../processManager'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const baseProcess: ManagedAgentProcess = {
  id: 'proc-1',
  workspaceId: 'ws-1',
  worktreePath: '/tmp/ws-1',
  agentType: 'claude-code',
  pid: 4242,
  status: 'starting',
  startedAt: 1700000000000,
  lastActivityAt: 1700000000000,
}

describe('AgentProcessManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('exports default and hard cap constants', () => {
    expect(MAX_CONCURRENT_AGENTS).toBe(3)
    expect(MAX_AGENTS_HARD_CAP).toBe(5)
  })

  it('spawns one process per workspace and reuses existing process', async () => {
    const invokeMock = vi.mocked(invoke)
    invokeMock.mockResolvedValueOnce(baseProcess)

    const manager = new AgentProcessManager()
    const first = await manager.spawn('ws-1', 'claude-code', '/tmp/ws-1')
    const second = await manager.spawn('ws-1', 'claude-code', '/tmp/ws-1')

    expect(first).toEqual(baseProcess)
    expect(second).toEqual(baseProcess)
    expect(invokeMock).toHaveBeenCalledTimes(1)
    expect(invokeMock).toHaveBeenCalledWith('agent_spawn', {
      request: {
        workspaceId: 'ws-1',
        agentType: 'claude-code',
        worktreePath: '/tmp/ws-1',
      },
    })
  })

  it('enforces configured max concurrent processes', async () => {
    const invokeMock = vi.mocked(invoke)
    invokeMock
      .mockResolvedValueOnce({ ...baseProcess, id: 'proc-1', workspaceId: 'ws-1' })
      .mockResolvedValueOnce({ ...baseProcess, id: 'proc-2', workspaceId: 'ws-2' })

    const manager = new AgentProcessManager(2)
    await manager.spawn('ws-1', 'claude-code', '/tmp/ws-1')
    await manager.spawn('ws-2', 'opencode', '/tmp/ws-2')

    await expect(manager.spawn('ws-3', 'cursor', '/tmp/ws-3')).rejects.toThrow(
      'Maximum concurrent agents reached (2)'
    )
  })

  it('enforces hard cap at 5 even if configured higher', async () => {
    const invokeMock = vi.mocked(invoke)
    for (let i = 1; i <= 5; i += 1) {
      invokeMock.mockResolvedValueOnce({ ...baseProcess, id: `proc-${i}`, workspaceId: `ws-${i}` })
    }

    const manager = new AgentProcessManager(999)

    for (let i = 1; i <= 5; i += 1) {
      await manager.spawn(`ws-${i}`, 'claude-code', `/tmp/ws-${i}`)
    }

    await expect(manager.spawn('ws-6', 'claude-code', '/tmp/ws-6')).rejects.toThrow(
      'Maximum concurrent agents reached (5)'
    )
  })

  it('kills a process by workspace and removes it from cache', async () => {
    const invokeMock = vi.mocked(invoke)
    invokeMock.mockResolvedValueOnce(baseProcess).mockResolvedValueOnce(undefined)

    const manager = new AgentProcessManager()
    await manager.spawn('ws-1', 'claude-code', '/tmp/ws-1')
    await manager.kill('ws-1')

    expect(manager.list()).toEqual([])
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'agent_kill', {
      request: { workspaceId: 'ws-1' },
    })
  })

  it('updates local status and crash metadata from backend status checks', async () => {
    const invokeMock = vi.mocked(invoke)
    invokeMock.mockResolvedValueOnce(baseProcess).mockResolvedValueOnce({
      ...baseProcess,
      status: 'error',
      lastExitCode: 1,
      crashed: true,
      canRestart: true,
    })

    const manager = new AgentProcessManager()
    await manager.spawn('ws-1', 'claude-code', '/tmp/ws-1')
    const status = await manager.getStatus('ws-1')

    expect(status?.status).toBe('error')
    expect(status?.lastExitCode).toBe(1)
    expect(status?.crashed).toBe(true)
    expect(status?.canRestart).toBe(true)
  })

  it('times out stalled tauri agent_spawn invokes', async () => {
    vi.useFakeTimers()

    const invokeMock = vi.mocked(invoke)
    invokeMock.mockImplementationOnce(() => new Promise(() => {}))

    const manager = new AgentProcessManager()
    const spawnPromise = manager.spawn('ws-timeout', 'claude-code', '/tmp/ws-timeout')
    const assertion = expect(spawnPromise).rejects.toThrow('Timed out while executing agent_spawn')

    await vi.advanceTimersByTimeAsync(TAURI_AGENT_INVOKE_TIMEOUT_MS + 1)
    await assertion
  })
})
