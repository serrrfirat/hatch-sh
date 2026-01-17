/**
 * @hatch/acp-client
 *
 * Client for communicating with Claude Code via the Claude Agent SDK.
 * Provides a unified interface for the "Bring Your Own Agent" mode.
 */

import { query, type ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";

export interface ACPClientConfig {
  /** Anthropic API key (required for BYOA mode) */
  apiKey?: string;
  /** Working directory for Claude Code */
  cwd?: string;
  /** System prompt to prepend */
  systemPrompt?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
}

export interface StreamEvent {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert React/TypeScript developer helping users build web applications.

When generating code:
1. Create complete, working React applications
2. Use TypeScript and modern React patterns (hooks, functional components)
3. Include TailwindCSS for styling (assume it's available)
4. Keep apps self-contained in a single file when possible
5. Always export a default App component
6. Make apps visually appealing with good UX

Output format: When providing code, wrap it in a code block with the language specified.

Be concise but helpful. Focus on building what the user asks for.`;

/**
 * ACP Client for communicating with Claude Code
 */
export class ACPClient {
  private config: ACPClientConfig;
  private sessionId: string | undefined;
  private abortController: AbortController | null = null;

  constructor(config: ACPClientConfig = {}) {
    this.config = {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ...config,
    };
  }

  /**
   * Set the Anthropic API key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    // Set environment variable for Claude Agent SDK
    process.env.ANTHROPIC_API_KEY = apiKey;
  }

  /**
   * Check if the client is configured with an API key
   */
  isConfigured(): boolean {
    return !!this.config.apiKey || !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Send a message and stream the response
   */
  async *sendMessage(
    content: string,
    options: { resume?: boolean } = {}
  ): AsyncGenerator<StreamEvent> {
    if (!this.isConfigured()) {
      yield { type: "error", error: "API key not configured" };
      return;
    }

    this.abortController = new AbortController();

    const queryOptions: ClaudeAgentOptions = {
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      permissionMode: "acceptEdits",
      systemPrompt: this.config.systemPrompt,
      ...(this.config.cwd && { cwd: this.config.cwd }),
      ...(options.resume && this.sessionId && { resume: this.sessionId }),
    };

    try {
      for await (const message of query({
        prompt: content,
        options: queryOptions,
        signal: this.abortController.signal,
      })) {
        // Handle different message types
        if (message.type === "system" && message.subtype === "init") {
          // Capture session ID for resuming
          this.sessionId = message.session_id;
        } else if (message.type === "assistant" && message.message?.content) {
          // Text content from assistant
          for (const block of message.message.content) {
            if (block.type === "text") {
              yield { type: "text", content: block.text };
            } else if (block.type === "tool_use") {
              yield {
                type: "tool_call",
                toolCall: {
                  id: block.id,
                  name: block.name,
                  input: block.input as Record<string, unknown>,
                },
              };
            }
          }
        } else if (message.type === "tool_result") {
          yield {
            type: "tool_result",
            toolCall: {
              id: message.tool_use_id,
              name: "",
              input: {},
              result: typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content),
            },
          };
        } else if ("result" in message) {
          // Final result
          yield { type: "text", content: message.result };
        }
      }

      yield { type: "done" };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          yield { type: "done" };
        } else {
          yield { type: "error", error: error.message };
        }
      } else {
        yield { type: "error", error: "Unknown error occurred" };
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Stop the current generation
   */
  stop(): void {
    this.abortController?.abort();
  }

  /**
   * Clear the session (start fresh conversation)
   */
  clearSession(): void {
    this.sessionId = undefined;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }
}

/**
 * Create a new ACP client instance
 */
export function createACPClient(config?: ACPClientConfig): ACPClient {
  return new ACPClient(config);
}

export default ACPClient;
