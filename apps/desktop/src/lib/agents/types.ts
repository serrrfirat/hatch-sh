/**
 * Multi-Agent Adapter System - Core Types
 *
 * Defines the interfaces for supporting multiple CLI-based AI agents
 * (Claude Code, Opencode, Cursor Agent) through a unified adapter pattern.
 */

/** Supported agent identifiers */
export type AgentId = 'claude-code' | 'opencode' | 'cursor'

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
  name: string
  description: string
  installUrl: string
  authCommand: string
  icon?: string
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
