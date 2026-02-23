import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Square, RotateCcw, MessageSquare, Cpu } from 'lucide-react'
import { agentProcessManager, type ManagedAgentProcess, type ProcessLifecycleStatus } from '../../lib/agents/processManager'
import { useRepositoryStore, type Workspace, type WorkspaceStatus } from '../../stores/repositoryStore'

// ─── Pure Functions (exported for testing) ──────────────────────────

export interface AgentRowData {
  workspaceId: string
  workspaceName: string
  branchName: string
  agentType: string
  status: ProcessLifecycleStatus
  workspaceStatus: WorkspaceStatus
  isStreaming: boolean
  elapsedTime: string
  startedAt: number
}

export function formatElapsedTime(startedAt: number): string {
  const diffMs = Date.now() - startedAt
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'Just now'
  if (diffHours < 1) return `${diffMins}m`
  if (diffDays < 1) return `${diffHours}h`
  return `${diffDays}d`
}

export function getAgentStatusLabel(status: ProcessLifecycleStatus): string {
  const labels: Record<ProcessLifecycleStatus, string> = {
    starting: 'Starting',
    streaming: 'Streaming',
    idle: 'Idle',
    error: 'Error',
    killed: 'Killed',
  }
  return labels[status]
}

export function getAgentStatusColor(status: ProcessLifecycleStatus): string {
  const colors: Record<ProcessLifecycleStatus, string> = {
    starting: 'bg-amber-500/20 text-amber-400',
    streaming: 'bg-emerald-500/20 text-emerald-400',
    idle: 'bg-neutral-500/20 text-neutral-400',
    error: 'bg-red-500/20 text-red-400',
    killed: 'bg-neutral-500/20 text-neutral-500',
  }
  return colors[status]
}

export function buildAgentRow(
  process: ManagedAgentProcess,
  workspace: Workspace | null,
): AgentRowData {
  return {
    workspaceId: process.workspaceId,
    workspaceName: workspace?.branchName ?? process.workspaceId,
    branchName: workspace?.branchName ?? process.workspaceId,
    agentType: process.agentType,
    status: process.status,
    workspaceStatus: workspace?.workspaceStatus ?? 'backlog',
    isStreaming: process.status === 'streaming',
    elapsedTime: formatElapsedTime(process.startedAt),
    startedAt: process.startedAt,
  }
}

// ─── Workspace Status Pill ──────────────────────────────────────────

const workspaceStatusConfig: Record<WorkspaceStatus, { label: string; className: string }> = {
  'backlog': { label: 'Backlog', className: 'bg-gray-600 text-gray-200' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-600 text-white' },
  'in-review': { label: 'Review', className: 'bg-yellow-500 text-black' },
  'done': { label: 'Done', className: 'bg-green-600 text-white' },
}

// ─── Agent Row Component ────────────────────────────────────────────

interface AgentRowProps {
  row: AgentRowData
  compact: boolean
  onSelect: () => void
  onKill: () => void
  onRestart: () => void
}

function AgentRow({ row, compact, onSelect, onKill, onRestart }: AgentRowProps) {
  const [isHovered, setIsHovered] = useState(false)

  if (compact) {
    return (
      <button
        onClick={onSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-white/5 transition-colors rounded-md"
        title={`${row.workspaceName} (${row.agentType}) - ${getAgentStatusLabel(row.status)}`}
      >
        {/* Streaming indicator */}
        {row.isStreaming ? (
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        ) : (
          <Cpu size={12} className="text-neutral-500 flex-shrink-0" />
        )}
        <span className="text-xs text-white truncate">{row.workspaceName}</span>
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group px-3 py-2 hover:bg-white/5 transition-colors rounded-md"
    >
      <div className="flex items-center gap-2">
        {/* Streaming indicator dot */}
        <div className="flex-shrink-0 w-4 flex items-center justify-center">
          {row.isStreaming ? (
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ) : row.status === 'error' ? (
            <div className="w-2 h-2 rounded-full bg-red-400" />
          ) : row.status === 'starting' ? (
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-neutral-600" />
          )}
        </div>

        {/* Content */}
        <button onClick={onSelect} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white truncate">{row.workspaceName}</span>
            {/* Agent status pill */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getAgentStatusColor(row.status)}`}>
              {getAgentStatusLabel(row.status)}
            </span>
            {/* Workspace status pill */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${workspaceStatusConfig[row.workspaceStatus].className}`}>
              {workspaceStatusConfig[row.workspaceStatus].label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
            <span>{row.agentType}</span>
            <span>·</span>
            <span>{row.elapsedTime}</span>
          </div>
        </button>

        {/* Quick actions */}
        <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
            title="Open Chat"
          >
            <MessageSquare size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRestart() }}
            className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-amber-400 transition-colors"
            title="Restart"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onKill() }}
            className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-red-400 transition-colors"
            title="Kill"
          >
            <Square size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Dashboard Component ────────────────────────────────────────────

interface AgentDashboardProps {
  compact?: boolean
}

export function AgentDashboard({ compact = false }: AgentDashboardProps) {
  const [processes, setProcesses] = useState<ManagedAgentProcess[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { workspaces, setCurrentWorkspace } = useRepositoryStore()

  // Poll active agents
  const refreshProcesses = useCallback(() => {
    setProcesses(agentProcessManager.list())
  }, [])

  useEffect(() => {
    refreshProcesses()
    const interval = setInterval(refreshProcesses, 2_000)
    return () => clearInterval(interval)
  }, [refreshProcesses])

  const findWorkspace = useCallback(
    (workspaceId: string): Workspace | null => {
      return workspaces.find((w: Workspace) => w.id === workspaceId) ?? null
    },
    [workspaces],
  )

  const handleSelectAgent = useCallback(
    (workspaceId: string) => {
      const ws = findWorkspace(workspaceId)
      if (ws) {
        setCurrentWorkspace(ws)
      }
    },
    [findWorkspace, setCurrentWorkspace],
  )

  const handleKillAgent = useCallback(
    async (workspaceId: string) => {
      try {
        await agentProcessManager.kill(workspaceId)
        refreshProcesses()
      } catch (_err) {
        // Kill failed silently
      }
    },
    [refreshProcesses],
  )

  const handleRestartAgent = useCallback(
    async (workspaceId: string) => {
      const proc = processes.find((p: ManagedAgentProcess) => p.workspaceId === workspaceId)
      if (!proc) return
      try {
        await agentProcessManager.kill(workspaceId)
        await agentProcessManager.spawn(workspaceId, proc.agentType, proc.worktreePath)
        refreshProcesses()
      } catch (_err) {
        // Restart failed silently
      }
    },
    [processes, refreshProcesses],
  )

  const rows: AgentRowData[] = processes.map((proc: ManagedAgentProcess) =>
    buildAgentRow(proc, findWorkspace(proc.workspaceId)),
  )

  return (
    <div className="border-t border-white/[0.06]">
      {/* Toggle Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Cpu size={12} />
          <span className="font-medium">Agents</span>
          {processes.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium">
              {processes.length}
            </span>
          )}
        </div>
        {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {rows.length === 0 ? (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-neutral-500">
                  No active agents. Create a workspace to start.
                </p>
              </div>
            ) : (
              <div className="pb-2 space-y-0.5">
                {rows.map((row: AgentRowData) => (
                  <AgentRow
                    key={row.workspaceId}
                    row={row}
                    compact={compact}
                    onSelect={() => handleSelectAgent(row.workspaceId)}
                    onKill={() => handleKillAgent(row.workspaceId)}
                    onRestart={() => handleRestartAgent(row.workspaceId)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}