/**
 * Multi-Agent System
 *
 * Exports all types, adapters, and registry functions for the
 * multi-agent adapter system.
 */

// Types
export type {
  AgentId,
  AgentStatus,
  AgentConfig,
  AgentMessage,
  AgentAdapter,
  StreamEvent,
  CommandResult,
} from './types'

// Registry
export {
  AGENT_CONFIGS,
  AGENT_IDS,
  agentAdapters,
  getAdapter,
  getConfig,
  isValidAgentId,
} from './registry'

// Adapters (for direct access if needed)
export { claudeCodeAdapter } from './adapters/claudeCode'
export { opencodeAdapter } from './adapters/opencode'
export { cursorAdapter } from './adapters/cursor'
