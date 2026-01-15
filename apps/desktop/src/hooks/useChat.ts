import { useCallback, useRef } from "react";
import { useChatStore, selectCurrentMessages, type Message, type ToolUse } from "../stores/chatStore";
import { useSettingsStore, isBYOAReady } from "../stores/settingsStore";
import { useRepositoryStore } from "../stores/repositoryStore";
import { sendWithHistoryStreaming, type StreamEvent } from "../lib/claudeCode/bridge";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

const SYSTEM_PROMPT = `You are an expert React/TypeScript developer helping users build web applications.

When generating code:
1. Create complete, working React applications
2. Use TypeScript and modern React patterns (hooks, functional components)
3. Include TailwindCSS for styling (assume it's available)
4. Keep apps self-contained in a single file when possible
5. Always export a default App component
6. Make apps visually appealing with good UX

Output format: When providing code, wrap it in a code block with the language specified.

Be concise but helpful. Focus on building what the user asks for.`;

export function useChat() {
  // Use selector for reactive messages (per-workspace)
  const messages = useChatStore(selectCurrentMessages);

  const {
    isLoading,
    currentProjectId,
    addMessage,
    updateMessage,
    updateMessageThinking,
    addToolUse,
    updateToolUse,
    setMessageDuration,
    setLoading,
  } = useChatStore();

  const settingsState = useSettingsStore();
  const { agentMode, claudeCodeStatus } = settingsState;

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const shouldStopRef = useRef(false);

  /**
   * Convert chat messages to simple format for Claude Code
   */
  const formatMessagesForClaudeCode = (msgs: Message[]) => {
    return msgs
      .filter((m) => !m.isStreaming && m.content.trim())
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
  };

  /**
   * Send message via Cloud mode (vibed.fun API)
   */
  const sendCloudMessage = useCallback(
    async (content: string, assistantMessageId: string) => {
      abortControllerRef.current = new AbortController();

      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProjectId,
          message: content,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Chat request failed");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let streamComplete = false;

      while (!streamComplete) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullContent += data.text;
                updateMessage(assistantMessageId, fullContent, true);
              }
              if (data.done) {
                streamComplete = true;
                break;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      return fullContent;
    },
    [currentProjectId, updateMessage]
  );

  /**
   * Send message via BYOA mode (local Claude Code)
   */
  const sendBYOAMessage = useCallback(
    async (content: string, assistantMessageId: string) => {
      // Check Claude Code is ready
      if (!claudeCodeStatus?.installed) {
        throw new Error(
          "Claude Code is not installed. Install it from https://claude.ai/download"
        );
      }
      if (!claudeCodeStatus?.authenticated) {
        throw new Error(
          'Claude Code is not authenticated. Run "claude login" in your terminal'
        );
      }

      shouldStopRef.current = false;

      // Get current messages for context (excluding the streaming placeholder)
      const currentMessages = selectCurrentMessages(useChatStore.getState());
      const formattedMessages = formatMessagesForClaudeCode(
        currentMessages.filter((m) => m.id !== assistantMessageId)
      );

      // Add the new user message
      formattedMessages.push({ role: "user", content });

      let fullContent = "";
      let thinkingContent = "";
      const toolUseMap = new Map<string, string>(); // toolId -> messageToolId

      // Stream handler
      const onStream = (event: StreamEvent) => {
        console.log('[useChat] Received stream event:', event.type, event);
        if (shouldStopRef.current) return;

        if (event.type === "text" && event.content) {
          fullContent += event.content;
          updateMessage(assistantMessageId, fullContent, true);
        } else if (event.type === "thinking" && event.content) {
          console.log('[useChat] THINKING event, updating message', assistantMessageId);
          thinkingContent += event.content;
          updateMessageThinking(assistantMessageId, thinkingContent);
        } else if (event.type === "tool_use" && event.toolName && event.toolId) {
          console.log('[useChat] TOOL_USE event:', event.toolName, event.toolId);
          // Add tool use to the message
          const tool: ToolUse = {
            id: event.toolId,
            name: event.toolName,
            input: event.toolInput || {},
            status: "running",
          };
          addToolUse(assistantMessageId, tool);
          toolUseMap.set(event.toolId, event.toolId);
        } else if (event.type === "tool_result" && event.toolId) {
          console.log('[useChat] TOOL_RESULT event:', event.toolId);
          // Update tool use with result
          updateToolUse(assistantMessageId, event.toolId, {
            result: event.toolResult,
            status: "completed",
          });
        } else if (event.type === "error") {
          console.error("Claude Code error:", event.content);
        }
      };

      // Get current options from settings store
      const { planModeEnabled, thinkingEnabled } = useSettingsStore.getState();

      // Get workspace path for working directory
      const { currentWorkspace } = useRepositoryStore.getState();
      const workingDirectory = currentWorkspace?.localPath;

      try {
        // Send to Claude Code via bridge with real-time streaming
        fullContent = await sendWithHistoryStreaming(
          formattedMessages,
          SYSTEM_PROMPT,
          onStream,
          { planMode: planModeEnabled, thinkingEnabled, workingDirectory }
        );
      } catch (error) {
        if (shouldStopRef.current) {
          // User stopped generation
          return fullContent || "Generation stopped.";
        }
        throw error;
      }

      return fullContent;
    },
    [claudeCodeStatus, updateMessage, updateMessageThinking, addToolUse, updateToolUse]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // For cloud mode, require project selection
      // For BYOA mode, allow chat without project (standalone mode)
      if (agentMode === "cloud" && !currentProjectId) {
        console.error("No project selected");
        addMessage({
          role: "assistant",
          content: "Please select a project before sending messages.",
        });
        return;
      }

      // Check BYOA mode requirements
      if (agentMode === "byoa" && !isBYOAReady(settingsState)) {
        const status = claudeCodeStatus;
        if (!status?.installed) {
          addMessage({
            role: "assistant",
            content:
              "Claude Code is not installed. Please install it from https://claude.ai/download and then click 'Check Connection' in settings.",
          });
        } else if (!status?.authenticated) {
          addMessage({
            role: "assistant",
            content:
              'Claude Code is not authenticated. Please run "claude login" in your terminal, then click "Check Connection" in settings.',
          });
        } else {
          addMessage({
            role: "assistant",
            content:
              "Please connect to Claude Code in settings to use BYOA mode.",
          });
        }
        return;
      }

      // Add user message
      addMessage({ role: "user", content });

      // Create placeholder for assistant response
      const assistantMessageId = addMessage({
        role: "assistant",
        content: "",
        isStreaming: true,
      });
      streamingMessageIdRef.current = assistantMessageId;

      setLoading(true);

      // IMPORTANT: Allow React to flush state updates and render the UI
      // before starting the potentially blocking async operation.
      // This ensures user sees their message + "Thinking..." indicator immediately.
      await new Promise((resolve) => setTimeout(resolve, 0));

      try {
        let fullContent: string;

        if (agentMode === "byoa") {
          fullContent = await sendBYOAMessage(content, assistantMessageId);
        } else {
          fullContent = await sendCloudMessage(content, assistantMessageId);
        }

        // Mark streaming as complete and set duration
        updateMessage(assistantMessageId, fullContent, false);
        setMessageDuration(assistantMessageId);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Keep the partial content but mark as not streaming
          const currentMessages = selectCurrentMessages(useChatStore.getState());
          const streamingMsg = currentMessages.find(
            (m) => m.id === assistantMessageId
          );
          if (streamingMsg) {
            updateMessage(
              assistantMessageId,
              streamingMsg.content || "Generation stopped.",
              false
            );
          }
          return;
        }
        updateMessage(
          assistantMessageId,
          `Sorry, an error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
          false
        );
        console.error("Chat error:", error);
      } finally {
        setLoading(false);
        streamingMessageIdRef.current = null;
      }
    },
    [
      currentProjectId,
      agentMode,
      claudeCodeStatus,
      settingsState,
      addMessage,
      updateMessage,
      setMessageDuration,
      setLoading,
      sendCloudMessage,
      sendBYOAMessage,
    ]
  );

  const stopGeneration = useCallback(() => {
    // For cloud mode, abort the fetch
    abortControllerRef.current?.abort();

    // For BYOA mode, set the stop flag
    shouldStopRef.current = true;

    // Update the streaming message to mark it as complete
    if (streamingMessageIdRef.current) {
      const currentMessages = selectCurrentMessages(useChatStore.getState());
      const streamingMsg = currentMessages.find(
        (m) => m.id === streamingMessageIdRef.current
      );
      if (streamingMsg) {
        updateMessage(
          streamingMessageIdRef.current,
          streamingMsg.content || "Generation stopped.",
          false
        );
      }
      streamingMessageIdRef.current = null;
    }

    setLoading(false);
  }, [setLoading, updateMessage]);

  return {
    messages,
    isLoading,
    agentMode,
    sendMessage,
    stopGeneration,
  };
}
