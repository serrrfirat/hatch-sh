import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AgentMode = "cloud" | "byoa";

export interface ClaudeCodeStatus {
  installed: boolean;
  authenticated: boolean;
  version?: string;
  error?: string;
  lastChecked?: number;
}

interface SettingsState {
  /** Current agent mode: 'cloud' uses vibed.fun credits, 'byoa' uses local Claude Code */
  agentMode: AgentMode;

  /** Claude Code connection status for BYOA mode */
  claudeCodeStatus: ClaudeCodeStatus | null;

  /** Whether we're currently checking Claude Code status */
  isCheckingClaudeCode: boolean;

  /** Legacy: User's Anthropic API key (deprecated, use Claude Code instead) */
  anthropicApiKey: string | null;
  apiKeyValidated: boolean;

  setAgentMode: (mode: AgentMode) => void;
  setClaudeCodeStatus: (status: ClaudeCodeStatus | null) => void;
  setIsCheckingClaudeCode: (checking: boolean) => void;

  /** Legacy methods for API key (kept for backward compatibility) */
  setAnthropicApiKey: (key: string | null) => void;
  setApiKeyValidated: (validated: boolean) => void;
  clearApiKey: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      agentMode: "cloud",
      claudeCodeStatus: null,
      isCheckingClaudeCode: false,
      anthropicApiKey: null,
      apiKeyValidated: false,

      setAgentMode: (mode) => set({ agentMode: mode }),
      setClaudeCodeStatus: (status) =>
        set({ claudeCodeStatus: status, isCheckingClaudeCode: false }),
      setIsCheckingClaudeCode: (checking) => set({ isCheckingClaudeCode: checking }),

      // Legacy methods
      setAnthropicApiKey: (key) => set({ anthropicApiKey: key, apiKeyValidated: false }),
      setApiKeyValidated: (validated) => set({ apiKeyValidated: validated }),
      clearApiKey: () => set({ anthropicApiKey: null, apiKeyValidated: false }),
    }),
    {
      name: "vibed-settings",
      partialize: (state) => ({
        agentMode: state.agentMode,
        // Don't persist claudeCodeStatus - always check fresh on app start
      }),
    }
  )
);

/**
 * Helper to check if BYOA mode is ready to use
 */
export function isBYOAReady(state: SettingsState): boolean {
  if (state.agentMode !== "byoa") return false;
  return state.claudeCodeStatus?.installed === true &&
         state.claudeCodeStatus?.authenticated === true;
}
