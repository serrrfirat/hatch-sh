import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AgentMode = "cloud" | "byoa";

interface SettingsState {
  /** Current agent mode: 'cloud' uses vibed.fun credits, 'byoa' uses user's API key */
  agentMode: AgentMode;
  /** User's Anthropic API key for BYOA mode */
  anthropicApiKey: string | null;
  /** Whether the API key has been validated */
  apiKeyValidated: boolean;

  setAgentMode: (mode: AgentMode) => void;
  setAnthropicApiKey: (key: string | null) => void;
  setApiKeyValidated: (validated: boolean) => void;
  clearApiKey: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      agentMode: "cloud",
      anthropicApiKey: null,
      apiKeyValidated: false,

      setAgentMode: (mode) => set({ agentMode: mode }),
      setAnthropicApiKey: (key) => set({ anthropicApiKey: key, apiKeyValidated: false }),
      setApiKeyValidated: (validated) => set({ apiKeyValidated: validated }),
      clearApiKey: () => set({ anthropicApiKey: null, apiKeyValidated: false }),
    }),
    {
      name: "vibed-settings",
      partialize: (state) => ({
        agentMode: state.agentMode,
        // Note: In production, consider more secure storage for API keys
        anthropicApiKey: state.anthropicApiKey,
      }),
    }
  )
);
