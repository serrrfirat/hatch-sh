import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, AlertCircle } from 'lucide-react'
import { cn } from '@hatch/ui'
import { useRepositoryStore } from '../../stores/repositoryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  AGENT_CONFIGS,
  getAgentsByProvider,
} from '../../lib/agents/registry'
import type { AgentId } from '../../lib/agents/types'
import { isLocalAgent } from '../../lib/agents/types'
import { getAgentIcon } from '../icons/AgentIcons'

export function AgentPicker() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { currentWorkspace, updateWorkspaceAgent } = useRepositoryStore()
  const { agentStatuses, agentMode, setAgentMode } = useSettingsStore()

  // Use workspace-specific agent if workspace exists, otherwise use global agentMode
  const selectedAgentId = currentWorkspace?.agentId || (agentMode === 'cloud' ? 'claude-code' : agentMode)
  const selectedConfig = AGENT_CONFIGS[selectedAgentId] || AGENT_CONFIGS['claude-code']
  // Only show local agents for now
  const agentsByProvider = getAgentsByProvider(true)

  // Sort providers to ensure consistent order: Anthropic, Open Source, Cursor
  const sortedProviders = Object.entries(agentsByProvider).sort(([a], [b]) => {
    const order = ['Anthropic', 'Open Source', 'Cursor']
    return order.indexOf(a) - order.indexOf(b)
  })

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectAgent = (agentId: AgentId) => {
    if (currentWorkspace) {
      // Update workspace-specific agent
      updateWorkspaceAgent(currentWorkspace.id, agentId)
    } else {
      // Update global agent mode when no workspace is selected
      setAgentMode(agentId)
    }
    setIsOpen(false)
  }

  // Get status for local agents
  const getLocalAgentStatus = (agentId: AgentId) => {
    if (!isLocalAgent(agentId)) return null
    return agentStatuses[agentId]
  }

  return (
    <div className="relative" ref={containerRef}>
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
        {(() => {
          const IconComponent = selectedConfig ? getAgentIcon(selectedConfig.id) : undefined
          return IconComponent ? (
            <IconComponent size={14} style={{ color: selectedConfig?.color || '#8b5cf6' }} />
          ) : (
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selectedConfig?.color || '#8b5cf6' }}
            />
          )
        })()}
        <span className="text-white">{selectedConfig?.name || 'Select Agent'}</span>
        <ChevronDown
          size={14}
          className={cn('text-neutral-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {/* Dropdown - positioned above the button */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.1 }}
            className={cn(
              'absolute left-0 bottom-full mb-2 z-50',
              'w-[280px] overflow-hidden',
              'bg-neutral-900 border border-white/10 rounded-xl shadow-xl'
            )}
          >
            {/* Agent List */}
            <div className="py-1">
              {sortedProviders.map(([provider, agents]) => (
                <div key={provider}>
                  {/* Provider Header - minimal */}
                  <div className="px-3 py-1.5 text-[10px] text-neutral-600 uppercase tracking-wider">
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
                          'w-full flex items-center gap-3 px-3 py-2',
                          'hover:bg-white/5 transition-colors',
                          isSelected && 'bg-white/8'
                        )}
                      >
                        {/* Agent icon */}
                        {(() => {
                          const IconComponent = getAgentIcon(config.id)
                          return IconComponent ? (
                            <IconComponent
                              size={16}
                              className="flex-shrink-0"
                              style={{ color: config.color }}
                            />
                          ) : (
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: config.color }}
                            />
                          )
                        })()}

                        {/* Agent info */}
                        <div className="flex-1 text-left min-w-0">
                          <span className="text-sm text-white">{config.name}</span>
                        </div>

                        {/* Status indicator */}
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : needsSetup ? (
                            <AlertCircle size={14} className="text-amber-400" />
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
