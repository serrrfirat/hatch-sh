/**
 * Agent Registry
 *
 * Central registry for all supported AI agents including:
 * - Local CLI agents (Claude Code, Opencode, Cursor)
 * - Cloud API models (Opus, Sonnet, Haiku, GPT variants)
 */

import type { AgentAdapter, AgentConfig, AgentId, LocalAgentId } from './types'
import { isLocalAgent } from './types'
import { claudeCodeAdapter, opencodeAdapter, cursorAdapter, codexAdapter } from './adapters'

/**
 * Static configuration for all supported agents
 */
export const AGENT_CONFIGS: Record<AgentId, AgentConfig> = {
  // Local CLI Agents
  'claude-code': {
    id: 'claude-code',
    type: 'local',
    name: 'Claude Code',
    description: "Anthropic's local AI coding assistant",
    provider: 'Anthropic',
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    authCommand: 'claude login',
    color: '#f97316', // Orange
  },
  opencode: {
    id: 'opencode',
    type: 'local',
    name: 'Opencode',
    description: 'Open-source AI coding agent with ACP protocol',
    provider: 'Open Source',
    installUrl: 'https://github.com/anomalyco/opencode',
    authCommand: 'opencode auth login --provider anthropic',
    color: '#10b981', // Emerald
  },
  cursor: {
    id: 'cursor',
    type: 'local',
    name: 'Cursor Agent',
    description: "Cursor's AI agent for code editing",
    provider: 'Cursor',
    installUrl: 'https://cursor.com/docs/cli',
    authCommand: 'agent login',
    color: '#06b6d4', // Cyan
  },
  codex: {
    id: 'codex',
    type: 'local',
    name: 'Codex CLI',
    description: 'OpenAI Codex local CLI agent',
    provider: 'OpenAI',
    installUrl: 'https://developers.openai.com/codex/cli',
    authCommand: 'codex login',
    color: '#22c55e',
  },

  // Cloud API Models - Anthropic
  'opus-4.5': {
    id: 'opus-4.5',
    type: 'cloud',
    name: 'Opus 4.5',
    description: 'Most capable model for complex tasks',
    provider: 'Anthropic',
    color: '#8b5cf6', // Purple
  },
  'sonnet-4.5': {
    id: 'sonnet-4.5',
    type: 'cloud',
    name: 'Sonnet 4.5',
    description: 'Balanced performance and speed',
    provider: 'Anthropic',
    color: '#a855f7', // Purple lighter
  },
  'haiku-4.5': {
    id: 'haiku-4.5',
    type: 'cloud',
    name: 'Haiku 4.5',
    description: 'Fast and efficient for simple tasks',
    provider: 'Anthropic',
    color: '#c084fc', // Purple lightest
  },

  // Cloud API Models - OpenAI/Codex
  'gpt-5.2-codex': {
    id: 'gpt-5.2-codex',
    type: 'cloud',
    name: 'GPT-5.2-Codex',
    description: 'Specialized for code generation',
    provider: 'OpenAI',
    color: '#22c55e', // Green
  },
  'gpt-5.2': {
    id: 'gpt-5.2',
    type: 'cloud',
    name: 'GPT-5.2',
    description: 'Latest GPT model',
    provider: 'OpenAI',
    color: '#16a34a', // Green darker
  },
  'gpt-5.1-codex-max': {
    id: 'gpt-5.1-codex-max',
    type: 'cloud',
    name: 'GPT-5.1-Codex-Max',
    description: 'Maximum context code generation',
    provider: 'OpenAI',
    color: '#15803d', // Green darkest
  },
}

/**
 * Adapters for local CLI agents only
 */
export const localAgentAdapters: Record<LocalAgentId, AgentAdapter> = {
  'claude-code': claudeCodeAdapter,
  opencode: opencodeAdapter,
  cursor: cursorAdapter,
  codex: codexAdapter,
}

/**
 * All agent IDs grouped by type
 */
export const LOCAL_AGENT_IDS: LocalAgentId[] = ['claude-code', 'opencode', 'cursor', 'codex']
export const CLOUD_MODEL_IDS: AgentId[] = [
  'opus-4.5',
  'sonnet-4.5',
  'haiku-4.5',
  'gpt-5.2-codex',
  'gpt-5.2',
  'gpt-5.1-codex-max',
]
export const ALL_AGENT_IDS: AgentId[] = [...LOCAL_AGENT_IDS, ...CLOUD_MODEL_IDS]

/**
 * Get agents grouped by provider for UI display
 * @param localOnly - If true, only return local CLI agents (default: false)
 */
export function getAgentsByProvider(localOnly = false): Record<string, AgentConfig[]> {
  const grouped: Record<string, AgentConfig[]> = {}

  for (const config of Object.values(AGENT_CONFIGS)) {
    // Skip cloud models if localOnly is true
    if (localOnly && config.type === 'cloud') {
      continue
    }
    if (!grouped[config.provider]) {
      grouped[config.provider] = []
    }
    grouped[config.provider].push(config)
  }

  return grouped
}

/**
 * Get the adapter for a local CLI agent
 *
 * @param agentId - The local agent identifier
 * @returns The agent adapter
 * @throws If the agent is not a local agent or not registered
 */
export function getLocalAdapter(agentId: AgentId): AgentAdapter {
  if (!isLocalAgent(agentId)) {
    throw new Error(`${agentId} is a cloud model, not a local agent`)
  }
  const adapter = localAgentAdapters[agentId]
  if (!adapter) {
    throw new Error(`Unknown local agent: ${agentId}`)
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
  return agentId in AGENT_CONFIGS
}

/**
 * Default agent for new workspaces
 */
export const DEFAULT_AGENT_ID: AgentId = 'claude-code'
