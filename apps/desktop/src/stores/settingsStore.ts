import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentId, AgentStatus } from "../lib/agents/types";
import { getAdapter, AGENT_IDS } from "../lib/agents/registry";

/** Agent mode: 'cloud' for vibed.fun API, or any AgentId for local CLI agents */
export type AgentMode = "cloud" | AgentId;

/** App page navigation */
export type AppPage = "byoa" | "discover";

/** Legacy type alias for backwards compatibility */
export type ClaudeCodeStatus = AgentStatus;

interface SettingsState {
  /** Current agent mode: 'cloud' uses vibed.fun credits, agent IDs use local CLI */
  agentMode: AgentMode;

  /** Status for each registered agent */
  agentStatuses: Record<AgentId, AgentStatus | null>;

  /** Whether we're currently checking an agent's status */
  isCheckingAgent: boolean;

  /** Whether the app has completed startup initialization */
  isAppReady: boolean;

  /** Current page: 'byoa' for build mode, 'discover' for browsing apps */
  currentPage: AppPage;

  /** Legacy: User's Anthropic API key (deprecated, use Claude Code instead) */
  anthropicApiKey: string | null;
  apiKeyValidated: boolean;

  // Actions
  setAgentMode: (mode: AgentMode) => void;
  setAgentStatus: (agentId: AgentId, status: AgentStatus | null) => void;
  setIsCheckingAgent: (checking: boolean) => void;
  setAppReady: (ready: boolean) => void;
  setCurrentPage: (page: AppPage) => void;

  /** Check status for a specific agent */
  checkAgentStatus: (agentId: AgentId) => Promise<AgentStatus>;

  /** Legacy: Get Claude Code status (for backwards compatibility) */
  get claudeCodeStatus(): AgentStatus | null;

  /** Legacy methods for API key (kept for backward compatibility) */
  setAnthropicApiKey: (key: string | null) => void;
  setApiKeyValidated: (validated: boolean) => void;
  clearApiKey: () => void;

  // Legacy setters for backwards compatibility
  setClaudeCodeStatus: (status: AgentStatus | null) => void;
  setIsCheckingClaudeCode: (checking: boolean) => void;
}

// Initialize empty status for all agents
const initialAgentStatuses: Record<AgentId, AgentStatus | null> = {
  "claude-code": null,
  opencode: null,
  cursor: null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      agentMode: "cloud",
      agentStatuses: { ...initialAgentStatuses },
      isCheckingAgent: false,
      isAppReady: false,
      currentPage: "byoa",
      anthropicApiKey: null,
      apiKeyValidated: false,

      setAgentMode: (mode) => set({ agentMode: mode }),

      setAgentStatus: (agentId, status) =>
        set((state) => ({
          agentStatuses: {
            ...state.agentStatuses,
            [agentId]: status ? { ...status, lastChecked: Date.now() } : null,
          },
          isCheckingAgent: false,
        })),

      setIsCheckingAgent: (checking) => set({ isCheckingAgent: checking }),
      setAppReady: (ready) => set({ isAppReady: ready }),
      setCurrentPage: (page) => set({ currentPage: page }),

      checkAgentStatus: async (agentId) => {
        set({ isCheckingAgent: true });
        try {
          const adapter = getAdapter(agentId);
          const status = await adapter.checkStatus();
          get().setAgentStatus(agentId, status);
          return status;
        } catch (error) {
          const errorStatus: AgentStatus = {
            installed: false,
            authenticated: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to check agent status",
          };
          get().setAgentStatus(agentId, errorStatus);
          return errorStatus;
        }
      },

      // Legacy getter for backwards compatibility
      get claudeCodeStatus() {
        return get().agentStatuses["claude-code"];
      },

      // Legacy setters for backwards compatibility
      setClaudeCodeStatus: (status) => {
        set((state) => ({
          agentStatuses: {
            ...state.agentStatuses,
            "claude-code": status
              ? { ...status, lastChecked: Date.now() }
              : null,
          },
          isCheckingAgent: false,
        }));
      },

      setIsCheckingClaudeCode: (checking) => set({ isCheckingAgent: checking }),

      // Legacy methods
      setAnthropicApiKey: (key) =>
        set({ anthropicApiKey: key, apiKeyValidated: false }),
      setApiKeyValidated: (validated) => set({ apiKeyValidated: validated }),
      clearApiKey: () =>
        set({ anthropicApiKey: null, apiKeyValidated: false }),
    }),
    {
      name: "vibed-settings",
      partialize: (state) => ({
        agentMode: state.agentMode,
        // Don't persist agentStatuses - always check fresh on app start
      }),
    }
  )
);

/**
 * Helper to check if the current agent mode is ready to use
 */
export function isAgentReady(state: SettingsState): boolean {
  // Cloud mode is always ready
  if (state.agentMode === "cloud") return true;

  // For local agents, check if installed and authenticated
  const agentId = state.agentMode as AgentId;
  const status = state.agentStatuses[agentId];
  return status?.installed === true && status?.authenticated === true;
}

/**
 * Get the status for the currently selected agent
 */
export function getCurrentAgentStatus(
  state: SettingsState
): AgentStatus | null {
  if (state.agentMode === "cloud") return null;
  return state.agentStatuses[state.agentMode as AgentId];
}

/**
 * Legacy: Helper to check if BYOA mode is ready to use
 * @deprecated Use isAgentReady instead
 */
export function isBYOAReady(state: SettingsState): boolean {
  // For backwards compatibility, check if any local agent is selected and ready
  if (state.agentMode === "cloud") return false;
  return isAgentReady(state);
}

/**
 * Check if a specific agent is ready
 */
export function isSpecificAgentReady(
  state: SettingsState,
  agentId: AgentId
): boolean {
  const status = state.agentStatuses[agentId];
  return status?.installed === true && status?.authenticated === true;
}

/**
 * Get list of all agent IDs
 */
export { AGENT_IDS };
