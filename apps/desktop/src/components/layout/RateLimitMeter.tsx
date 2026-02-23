import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { agentProcessManager, type ManagedAgentProcess } from '../../lib/agents/processManager'
import { useChatStore } from '../../stores/chatStore'
import { useRepositoryStore } from '../../stores/repositoryStore'

export const TIER_2_RATE_LIMIT = 90_000
export const EST_TOKENS_PER_ACTIVE_AGENT = 15_000
export const EST_TOKENS_PER_MESSAGE = 4_000
export const EST_MEMORY_PER_AGENT_MB = 300
export const MEMORY_WARNING_THRESHOLD_MB = 1024

export function estimateRateUsage(agentCount: number, messageCount: number): number {
  if (agentCount <= 0) return 0
  const estimatedTokens =
    agentCount * EST_TOKENS_PER_ACTIVE_AGENT + messageCount * EST_TOKENS_PER_MESSAGE
  const percentage = Math.round((estimatedTokens / TIER_2_RATE_LIMIT) * 100)
  return Math.min(Math.max(percentage, 0), 100)
}

export function getRateLimitColor(percentage: number): 'green' | 'yellow' | 'red' {
  if (percentage >= 80) return 'red'
  if (percentage >= 50) return 'yellow'
  return 'green'
}

export function shouldShowWarning(percentage: number): boolean {
  return percentage > 80
}

export function estimateAgentMemoryMB(agentCount: number): number {
  if (agentCount <= 0) return 0
  return agentCount * EST_MEMORY_PER_AGENT_MB
}

export function shouldShowMemoryWarning(availableMemoryMB: number): boolean {
  return availableMemoryMB < MEMORY_WARNING_THRESHOLD_MB
}

export function formatRateLabel(percentage: number): string {
  return `API: ~${percentage}% of rate limit`
}

const COLOR_CLASSES = {
  green: {
    bar: 'bg-emerald-500/70',
    text: 'text-emerald-400/70',
  },
  yellow: {
    bar: 'bg-amber-500/70',
    text: 'text-amber-400/70',
  },
  red: {
    bar: 'bg-red-500/80',
    text: 'text-red-400/80',
  },
} as const

export function RateLimitMeter() {
  const [processes, setProcesses] = useState<ManagedAgentProcess[]>([])
  const [showTooltip, setShowTooltip] = useState(false)
  const messagesByWorkspace = useChatStore((state) => state.messagesByWorkspace)
  const workspaces = useRepositoryStore((state) => state.workspaces)

  const refreshProcesses = useCallback(() => {
    setProcesses(agentProcessManager.list())
  }, [])

  useEffect(() => {
    refreshProcesses()
    const interval = setInterval(refreshProcesses, 2_000)
    return () => clearInterval(interval)
  }, [refreshProcesses])

  const agentCount = processes.length

  const recentMessageCount = useMemo(() => {
    let count = 0
    const oneMinuteAgo = Date.now() - 60_000
    for (const wsId of Object.keys(messagesByWorkspace)) {
      const msgs = messagesByWorkspace[wsId]
      if (!msgs) continue
      for (let i = msgs.length - 1; i >= 0; i--) {
        const msg = msgs[i]
        if (msg.timestamp && new Date(msg.timestamp).getTime() > oneMinuteAgo) {
          count++
        } else {
          break
        }
      }
    }
    return count
  }, [messagesByWorkspace])

  const percentage = estimateRateUsage(agentCount, recentMessageCount)
  const color = getRateLimitColor(percentage)
  const colorClasses = COLOR_CLASSES[color]
  const isWarning = shouldShowWarning(percentage)
  const totalMemoryMB = estimateAgentMemoryMB(agentCount)

  if (agentCount < 2) return null

  return (
    <div className="border-t border-white/[0.06]">
      <div
        className="flex items-center gap-2 px-4 py-1.5"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="relative flex items-center gap-2 flex-1">
          <span className={`text-[10px] font-mono ${colorClasses.text} whitespace-nowrap`}>
            {formatRateLabel(percentage)}
          </span>

          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden max-w-[120px]">
            <div
              className={`h-full ${colorClasses.bar} rounded-full transition-all duration-300`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <span className={`text-[10px] font-mono ${colorClasses.text}`}>{percentage}%</span>

          {isWarning && (
            <span className="text-[10px]" title="Rate limit usage high">
              ⚠️
            </span>
          )}

          {showTooltip && (
            <div className="absolute top-full left-0 mt-1 z-50 px-3 py-2 bg-gray-800 border border-white/[0.1] rounded-md shadow-xl">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-white/60 whitespace-nowrap block">
                  {agentCount} agents active | ~{totalMemoryMB}MB est. RAM
                </span>
                <span className="text-[10px] font-mono text-white/60 whitespace-nowrap block">
                  ~{TIER_2_RATE_LIMIT / agentCount} tokens/min per agent (Tier 2)
                </span>
                {workspaces.length > 0 && (
                  <span className="text-[10px] font-mono text-white/40 whitespace-nowrap block">
                    {recentMessageCount} messages in last minute
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {isWarning && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border-t border-red-500/20">
          <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
          <span className="text-[10px] font-mono text-red-400">
            High rate limit usage — consider reducing active agents
          </span>
        </div>
      )}
    </div>
  )
}
