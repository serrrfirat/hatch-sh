/**
 * Multi-Agent Adapter System - Core Types
 *
 * Defines the interfaces for supporting multiple AI agents including:
 * - Local CLI agents (Claude Code, Opencode, Cursor Agent)
 * - Cloud API models (Opus, Sonnet, Haiku, GPT variants)
 */

/** Local CLI agent identifiers */
export type LocalAgentId = 'claude-code' | 'opencode' | 'cursor'

/** Cloud model identifiers */
export type CloudModelId =
  | 'opus-4.5'
  | 'sonnet-4.5'
  | 'haiku-4.5'
  | 'gpt-5.2-codex'
  | 'gpt-5.2'
  | 'gpt-5.1-codex-max'

/** All supported agent/model identifiers */
export type AgentId = LocalAgentId | CloudModelId

/** Agent type classification */
export type AgentType = 'local' | 'cloud'

/** Helper to check if an agent is a local CLI agent */
export function isLocalAgent(agentId: AgentId): agentId is LocalAgentId {
  return ['claude-code', 'opencode', 'cursor'].includes(agentId)
}

/** Helper to check if an agent is a cloud model */
export function isCloudModel(agentId: AgentId): agentId is CloudModelId {
  return !isLocalAgent(agentId)
}

/** Agent installation and authentication status */
export interface AgentStatus {
  installed: boolean
  authenticated: boolean
  version?: string
  error?: string
  path?: string
  lastChecked?: number
}

/** Static configuration for an agent */
export interface AgentConfig {
  id: AgentId
  type: AgentType
  name: string
  description: string
  /** Provider (e.g., "Anthropic", "OpenAI", "Local") */
  provider: string
  /** Install URL for local agents */
  installUrl?: string
  /** Auth command for local agents */
  authCommand?: string
  /** Icon identifier */
  icon?: string
  /** Color for UI theming */
  color?: string
}

/** Streaming event emitted during agent message processing */
export interface StreamEvent {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'error' | 'done'
  content?: string
  toolId?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
}

/** Message format for agent communication */
export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Result from a Tauri command execution */
export interface CommandResult {
  success: boolean
  stdout: string
  stderr: string
  code?: number
}

/**
 * Agent Adapter Interface
 *
 * Each supported agent must implement this interface to be integrated
 * into the Conductor app. The adapter handles:
 * - Status checking (installation, authentication)
 * - Message sending with streaming support
 * - Output parsing to normalize events
 */
export interface AgentAdapter {
  /** Unique identifier for this agent */
  id: AgentId

  /** Static configuration */
  config: AgentConfig

  /**
   * Check if the agent is installed and authenticated
   */
  checkStatus(): Promise<AgentStatus>

  /**
   * Send a message to the agent and receive streaming responses
   *
   * @param messages - Conversation history
   * @param systemPrompt - Optional system prompt
   * @param onStream - Callback for streaming events
   * @returns The full response content
   */
  sendMessage(
    messages: AgentMessage[],
    systemPrompt?: string,
    onStream?: (event: StreamEvent) => void
  ): Promise<string>

  /**
   * Parse a single line of output into a StreamEvent
   *
   * @param line - Raw output line from the agent CLI
   * @returns Parsed event or null if line should be ignored
   */
  parseOutput(line: string): StreamEvent | null
}
