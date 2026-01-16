import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentId, AgentStatus, LocalAgentId } from "../lib/agents/types";
import { isLocalAgent } from "../lib/agents/types";
import { getLocalAdapter, LOCAL_AGENT_IDS, ALL_AGENT_IDS } from "../lib/agents/registry";

/** Agent mode: 'cloud' for vibed.fun API, or any AgentId for local CLI agents */
export type AgentMode = "cloud" | AgentId;

/** App page navigation */
export type AppPage = "byoa" | "discover" | "idea-maze";

/** Legacy type alias for backwards compatibility */
export type ClaudeCodeStatus = AgentStatus;

interface SettingsState {
  /** Current agent mode: 'cloud' uses vibed.fun credits, agent IDs use local CLI */
  agentMode: AgentMode;

  /** Status for each local CLI agent (cloud models don't need status tracking) */
  agentStatuses: Record<LocalAgentId, AgentStatus | null>;

  /** Whether we're currently checking an agent's status */
  isCheckingAgent: boolean;

  /** Whether the app has completed startup initialization */
  isAppReady: boolean;

  /** Current page: 'byoa' for build mode, 'discover' for browsing apps */
  currentPage: AppPage;

  /** Plan mode: Claude will create plans before executing */
  planModeEnabled: boolean;

  /** Extended thinking: Show/hide Claude's reasoning process in the UI.
   *  This is display-only - Claude Code always generates thinking blocks,
   *  but they can be hidden based on this preference. */
  thinkingEnabled: boolean;

  /** Legacy: User's Anthropic API key (deprecated, use Claude Code instead) */
  anthropicApiKey: string | null;
  apiKeyValidated: boolean;

  // Actions
  setAgentMode: (mode: AgentMode) => void;
  setAgentStatus: (agentId: LocalAgentId, status: AgentStatus | null) => void;
  setIsCheckingAgent: (checking: boolean) => void;
  setAppReady: (ready: boolean) => void;
  setCurrentPage: (page: AppPage) => void;
  setPlanModeEnabled: (enabled: boolean) => void;
  setThinkingEnabled: (enabled: boolean) => void;

  /** Check status for a local CLI agent */
  checkAgentStatus: (agentId: LocalAgentId) => Promise<AgentStatus>;

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

// Initialize empty status for all local CLI agents
const initialAgentStatuses: Record<LocalAgentId, AgentStatus | null> = {
  "claude-code": null,
  opencode: null,
  cursor: null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      agentMode: "byoa",
      agentStatuses: { ...initialAgentStatuses },
      isCheckingAgent: false,
      isAppReady: false,
      currentPage: "byoa",
      planModeEnabled: false,
      thinkingEnabled: true,
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
      setPlanModeEnabled: (enabled) => set({ planModeEnabled: enabled }),
      setThinkingEnabled: (enabled) => set({ thinkingEnabled: enabled }),

      checkAgentStatus: async (agentId) => {
        set({ isCheckingAgent: true });
        try {
          const adapter = getLocalAdapter(agentId);
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
        planModeEnabled: state.planModeEnabled,
        thinkingEnabled: state.thinkingEnabled,
        // Don't persist agentStatuses - always check fresh on app start
      }),
    }
  )
);

/**
 * Helper to check if the current global agent mode is ready to use
 * @deprecated Use isWorkspaceAgentReady instead for per-workspace agents
 */
export function isAgentReady(state: SettingsState): boolean {
  // Cloud mode is always ready
  if (state.agentMode === "cloud") return true;

  // For local agents, check if installed and authenticated
  if (!isLocalAgent(state.agentMode)) return true; // Cloud models always ready

  const status = state.agentStatuses[state.agentMode];
  return status?.installed === true && status?.authenticated === true;
}

/**
 * Check if a specific agent is ready to use
 * - Cloud models are always ready
 * - Local agents need to be installed and authenticated
 */
export function isWorkspaceAgentReady(
  state: SettingsState,
  agentId: AgentId
): boolean {
  // Cloud models are always ready
  if (!isLocalAgent(agentId)) return true;

  // Local agents need status check
  const status = state.agentStatuses[agentId];
  return status?.installed === true && status?.authenticated === true;
}

/**
 * Get the status for the currently selected global agent
 * @deprecated Use getAgentStatus for per-workspace agents
 */
export function getCurrentAgentStatus(
  state: SettingsState
): AgentStatus | null {
  if (state.agentMode === "cloud") return null;
  if (!isLocalAgent(state.agentMode)) return null;
  return state.agentStatuses[state.agentMode];
}

/**
 * Get the status for a specific local agent
 */
export function getAgentStatus(
  state: SettingsState,
  agentId: AgentId
): AgentStatus | null {
  if (!isLocalAgent(agentId)) return null;
  return state.agentStatuses[agentId];
}

/**
 * Legacy: Helper to check if BYOA mode is ready to use
 * @deprecated Use isWorkspaceAgentReady instead
 */
export function isBYOAReady(state: SettingsState): boolean {
  // For backwards compatibility, check if any local agent is selected and ready
  if (state.agentMode === "cloud") return false;
  return isAgentReady(state);
}

/**
 * Check if a specific agent is ready
 * @deprecated Use isWorkspaceAgentReady instead
 */
export function isSpecificAgentReady(
  state: SettingsState,
  agentId: AgentId
): boolean {
  return isWorkspaceAgentReady(state, agentId);
}

/**
 * Get list of all agent IDs
 */
export { ALL_AGENT_IDS, LOCAL_AGENT_IDS };
