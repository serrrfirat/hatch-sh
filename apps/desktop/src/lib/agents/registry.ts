/**
 * Agent Registry
 *
 * Central registry for all supported AI coding agents.
 * Provides configuration lookup and adapter retrieval.
 */

import type { AgentAdapter, AgentConfig, AgentId } from './types'
import { claudeCodeAdapter, opencodeAdapter, cursorAdapter } from './adapters'

/**
 * Static configuration for all supported agents
 */
export const AGENT_CONFIGS: Record<AgentId, AgentConfig> = {
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    description: "Anthropic's AI coding assistant",
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    authCommand: 'claude login',
  },
  opencode: {
    id: 'opencode',
    name: 'Opencode',
    description: 'Open-source AI coding agent with ACP protocol',
    installUrl: 'https://github.com/anomalyco/opencode',
    authCommand: 'opencode auth login --provider anthropic',
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor Agent',
    description: "Cursor's AI agent for code editing",
    installUrl: 'https://cursor.com/docs/cli',
    authCommand: 'agent login',
  },
}

/**
 * All registered agent adapters
 */
export const agentAdapters: Record<AgentId, AgentAdapter> = {
  'claude-code': claudeCodeAdapter,
  opencode: opencodeAdapter,
  cursor: cursorAdapter,
}

/**
 * List of all available agent IDs
 */
export const AGENT_IDS: AgentId[] = ['claude-code', 'opencode', 'cursor']

/**
 * Get the adapter for a specific agent
 *
 * @param agentId - The agent identifier
 * @returns The agent adapter
 * @throws If the agent is not registered
 */
export function getAdapter(agentId: AgentId): AgentAdapter {
  const adapter = agentAdapters[agentId]
  if (!adapter) {
    throw new Error(`Unknown agent: ${agentId}`)
  }
  return adapter
}

/**
 * Get the configuration for a specific agent
 *
 * @param agentId - The agent identifier
 * @returns The agent configuration
 */
export function getConfig(agentId: AgentId): AgentConfig {
  return AGENT_CONFIGS[agentId]
}

/**
 * Check if an agent ID is valid
 *
 * @param agentId - The agent identifier to check
 * @returns True if the agent is registered
 */
export function isValidAgentId(agentId: string): agentId is AgentId {
  return agentId in agentAdapters
}
