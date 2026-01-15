import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, Terminal, AlertCircle } from 'lucide-react'
import { cn } from '@vibed/ui'
import { useRepositoryStore } from '../../stores/repositoryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  AGENT_CONFIGS,
  getAgentsByProvider,
} from '../../lib/agents/registry'
import type { AgentId } from '../../lib/agents/types'
import { isLocalAgent } from '../../lib/agents/types'

export function AgentPicker() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { currentWorkspace, updateWorkspaceAgent } = useRepositoryStore()
  const { agentStatuses } = useSettingsStore()

  const selectedAgentId = currentWorkspace?.agentId || 'claude-code'
  const selectedConfig = AGENT_CONFIGS[selectedAgentId]
  // Only show local agents for now
  const agentsByProvider = getAgentsByProvider(true)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectAgent = (agentId: AgentId) => {
    if (currentWorkspace) {
      updateWorkspaceAgent(currentWorkspace.id, agentId)
    }
    setIsOpen(false)
  }

  // Get status for local agents
  const getLocalAgentStatus = (agentId: AgentId) => {
    if (!isLocalAgent(agentId)) return null
    return agentStatuses[agentId]
  }

  if (!currentWorkspace) return null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'bg-neutral-800 border border-white/10',
          'hover:bg-neutral-700 hover:border-white/20',
          'transition-colors text-sm'
        )}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: selectedConfig?.color || '#8b5cf6' }}
        />
        <span className="text-white">{selectedConfig?.name || 'Select Agent'}</span>
        <ChevronDown
          size={14}
          className={cn('text-neutral-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute left-0 bottom-full mb-2 z-50',
              'w-72 max-h-[400px] overflow-y-auto',
              'bg-neutral-900 border border-white/10 rounded-xl shadow-xl'
            )}
          >
            {Object.entries(agentsByProvider).map(([provider, agents]) => (
              <div key={provider} className="border-b border-white/5 last:border-b-0">
                {/* Provider Header */}
                <div className="px-3 py-2 flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wider">
                  <Terminal size={12} />
                  {provider}
                </div>

                {/* Agent Options */}
                {agents.map((config) => {
                  const isSelected = selectedAgentId === config.id
                  const status = getLocalAgentStatus(config.id)
                  const isLocal = isLocalAgent(config.id)
                  const needsSetup = isLocal && (!status?.installed || !status?.authenticated)

                  return (
                    <button
                      key={config.id}
                      onClick={() => handleSelectAgent(config.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5',
                        'hover:bg-white/5 transition-colors',
                        isSelected && 'bg-white/10'
                      )}
                    >
                      {/* Color indicator */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: config.color }}
                      />

                      {/* Agent info */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">{config.name}</span>
                          {isLocal && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                              Local
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 truncate">
                          {config.description}
                        </p>
                      </div>

                      {/* Status / Selection indicator */}
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <Check size={16} className="text-emerald-400" />
                        ) : needsSetup ? (
                          <AlertCircle size={16} className="text-amber-400" />
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
