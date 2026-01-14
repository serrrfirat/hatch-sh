import { useCallback, useRef } from "react";
import { useChatStore, type Message } from "../stores/chatStore";
import { useSettingsStore } from "../stores/settingsStore";

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
  const {
    messages,
    isLoading,
    currentProjectId,
    addMessage,
    updateMessage,
    setLoading,
  } = useChatStore();

  const { agentMode, anthropicApiKey } = useSettingsStore();

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  /**
   * Convert chat messages to Anthropic API format
   */
  const formatMessagesForAnthropic = (msgs: Message[]) => {
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
   * Send message via BYOA mode (direct Anthropic API call)
   */
  const sendBYOAMessage = useCallback(
    async (content: string, assistantMessageId: string) => {
      if (!anthropicApiKey) {
        throw new Error("Please configure your Anthropic API key in settings");
      }

      abortControllerRef.current = new AbortController();

      // Get current messages for context (excluding the streaming placeholder)
      const currentMessages = useChatStore.getState().messages;
      const formattedMessages = formatMessagesForAnthropic(
        currentMessages.filter((m) => m.id !== assistantMessageId)
      );

      // Add the new user message
      formattedMessages.push({ role: "user", content });

      // Call Anthropic API directly with streaming
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: formattedMessages,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "API request failed");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              // Handle content_block_delta events
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                fullContent += parsed.delta.text;
                updateMessage(assistantMessageId, fullContent, true);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      return fullContent;
    },
    [anthropicApiKey, updateMessage]
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
      if (agentMode === "byoa" && !anthropicApiKey) {
        addMessage({
          role: "assistant",
          content:
            "Please configure your Anthropic API key in settings to use BYOA mode.",
        });
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

      try {
        let fullContent: string;

        if (agentMode === "byoa") {
          fullContent = await sendBYOAMessage(content, assistantMessageId);
        } else {
          fullContent = await sendCloudMessage(content, assistantMessageId);
        }

        // Mark streaming as complete
        updateMessage(assistantMessageId, fullContent, false);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Keep the partial content but mark as not streaming
          const currentMessages = useChatStore.getState().messages;
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
      anthropicApiKey,
      addMessage,
      updateMessage,
      setLoading,
      sendCloudMessage,
      sendBYOAMessage,
    ]
  );

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();

    // Update the streaming message to mark it as complete
    if (streamingMessageIdRef.current) {
      const currentMessages = useChatStore.getState().messages;
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
