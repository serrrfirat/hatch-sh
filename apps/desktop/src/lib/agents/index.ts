/**
 * Multi-Agent System
 *
 * Exports all types, adapters, and registry functions for the
 * multi-agent adapter system.
 */

// Types
export type {
  AgentId,
  LocalAgentId,
  CloudModelId,
  AgentType,
  AgentStatus,
  AgentConfig,
  AgentMessage,
  AgentAdapter,
  StreamEvent,
  CommandResult,
} from './types'

// Type guards
export { isLocalAgent } from './types'

// Registry
export {
  AGENT_CONFIGS,
  ALL_AGENT_IDS,
  LOCAL_AGENT_IDS,
  CLOUD_MODEL_IDS,
  localAgentAdapters,
  getLocalAdapter,
  getConfig,
  isValidAgentId,
  getAgentsByProvider,
  DEFAULT_AGENT_ID,
} from './registry'

// Adapters (for direct access if needed)
export { claudeCodeAdapter } from './adapters/claudeCode'
export { opencodeAdapter } from './adapters/opencode'
export { cursorAdapter } from './adapters/cursor'
