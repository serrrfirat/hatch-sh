import { invoke } from '@tauri-apps/api/core'
import type { LocalAgentId } from './types'

export const MAX_CONCURRENT_AGENTS = 3
export const MAX_AGENTS_HARD_CAP = 5
export const TAURI_AGENT_INVOKE_TIMEOUT_MS = 15000

export type ProcessLifecycleStatus = 'starting' | 'streaming' | 'idle' | 'error' | 'killed'

export interface ManagedAgentProcess {
  id: string
  workspaceId: string
  worktreePath: string
  agentType: LocalAgentId
  pid?: number
  status: ProcessLifecycleStatus
  startedAt: number
  lastActivityAt?: number
  lastExitCode?: number
  crashed?: boolean
  canRestart?: boolean
}

interface SpawnAgentRequest {
  workspaceId: string
  agentType: LocalAgentId
  worktreePath: string
}

interface KillAgentRequest {
  workspaceId: string
}

function clampMaxConcurrent(requested: number): number {
  if (!Number.isFinite(requested) || requested < 1) {
    return MAX_CONCURRENT_AGENTS
  }
  return Math.min(Math.floor(requested), MAX_AGENTS_HARD_CAP)
}

async function invokeWithTimeout<T>(
  command: string,
  payload: Record<string, unknown>,
  timeoutMs = TAURI_AGENT_INVOKE_TIMEOUT_MS
): Promise<T> {
  const invokePromise = invoke<T>(command, payload)
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timed out while executing ${command}`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([invokePromise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export class AgentProcessManager {
  private readonly processesByWorkspace = new Map<string, ManagedAgentProcess>()

  private readonly maxConcurrent: number

  constructor(maxConcurrent = MAX_CONCURRENT_AGENTS) {
    this.maxConcurrent = clampMaxConcurrent(maxConcurrent)
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent
  }

  list(): ManagedAgentProcess[] {
    return Array.from(this.processesByWorkspace.values()).sort((a, b) => a.startedAt - b.startedAt)
  }

  canSpawnMore(): boolean {
    return this.processesByWorkspace.size < this.maxConcurrent
  }

  async spawn(
    workspaceId: string,
    agentType: LocalAgentId,
    worktreePath: string
  ): Promise<ManagedAgentProcess> {
    const existing = this.processesByWorkspace.get(workspaceId)
    if (existing && existing.status !== 'killed') {
      return existing
    }

    if (!this.canSpawnMore()) {
      throw new Error(`Maximum concurrent agents reached (${this.maxConcurrent})`)
    }

    const request: SpawnAgentRequest = {
      workspaceId,
      agentType,
      worktreePath,
    }

    const spawned = await invokeWithTimeout<ManagedAgentProcess>('agent_spawn', { request })
    this.processesByWorkspace.set(workspaceId, spawned)
    return spawned
  }

  async kill(workspaceId: string): Promise<void> {
    if (!this.processesByWorkspace.has(workspaceId)) {
      return
    }

    const request: KillAgentRequest = { workspaceId }
    await invokeWithTimeout<void>('agent_kill', { request })
    this.processesByWorkspace.delete(workspaceId)
  }

  async getStatus(
    workspaceId: string,
    options?: { timeoutMs?: number }
  ): Promise<ManagedAgentProcess | null> {
    const existing = this.processesByWorkspace.get(workspaceId)
    if (!existing) {
      return null
    }

    const request = { workspaceId }
    const status = await invokeWithTimeout<ManagedAgentProcess | null>(
      'agent_status',
      { request },
      options?.timeoutMs
    )
    if (!status) {
      this.processesByWorkspace.delete(workspaceId)
      return null
    }

    this.processesByWorkspace.set(workspaceId, status)
    return status
  }

  markStreaming(workspaceId: string): void {
    const process = this.processesByWorkspace.get(workspaceId)
    if (!process) return
    this.processesByWorkspace.set(workspaceId, {
      ...process,
      status: 'streaming',
      lastActivityAt: Date.now(),
    })
  }

  markIdle(workspaceId: string): void {
    const process = this.processesByWorkspace.get(workspaceId)
    if (!process) return
    this.processesByWorkspace.set(workspaceId, {
      ...process,
      status: 'idle',
      lastActivityAt: Date.now(),
    })
  }
}

export const agentProcessManager = new AgentProcessManager()
