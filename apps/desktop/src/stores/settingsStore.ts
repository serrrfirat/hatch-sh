import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import type { AgentId, AgentStatus, LocalAgentId, ModelInfo, AvailableModels } from "../lib/agents/types";
import { isLocalAgent } from "../lib/agents/types";
import { getLocalAdapter, LOCAL_AGENT_IDS, ALL_AGENT_IDS } from "../lib/agents/registry";
import { keychainHas, type KeychainKey, KEYCHAIN_KEYS } from "../lib/keychain";

/** Agent mode: 'cloud' for hatch.sh API, or any AgentId for local CLI agents */
export type AgentMode = "cloud" | AgentId;

/** App page navigation */
export type AppPage = "byoa" | "design" | "idea-maze" | "marketplace" | "settings";

/** Legacy type alias for backwards compatibility */
export type ClaudeCodeStatus = AgentStatus;

/** Branch name prefix options */
export type BranchNamePrefix = "github-username" | "custom" | "none";

/** Model options for agents - can be "default" or any model ID string */
export type AgentModel = string;

/** Agent model configuration */
export interface AgentModelConfig {
  opencode: string;
  cursor: string;
}

/** Available models for each agent */
export interface AvailableAgentModels {
  opencode: ModelInfo[];
  cursor: ModelInfo[];
}

interface SettingsState {
  /** Current agent mode: 'cloud' uses hatch.sh credits, agent IDs use local CLI */
  agentMode: AgentMode;

  /** Status for each local CLI agent (cloud models don't need status tracking) */
  agentStatuses: Record<LocalAgentId, AgentStatus | null>;

  /** Whether we're currently checking an agent's status */
  isCheckingAgent: boolean;

  /** Whether the app has completed startup initialization */
  isAppReady: boolean;

  /** Current page: 'byoa' for build mode, 'idea-maze' for brainstorming */
  currentPage: AppPage;

  /** Plan mode: Claude will create plans before executing */
  planModeEnabled: boolean;

  /** Extended thinking: Show/hide Claude's reasoning process in the UI.
   *  This is display-only - Claude Code always generates thinking blocks,
   *  but they can be hidden based on this preference. */
  thinkingEnabled: boolean;

  // Chat settings
  /** Desktop notifications when AI finishes */
  desktopNotifications: boolean;
  /** Sound effects when AI finishes */
  soundEffects: boolean;
  /** Auto-convert pasted text over 5000 chars to attachments */
  autoConvertLongText: boolean;
  /** Strip "You're absolutely right!" from AI messages */
  stripAbsolutelyRight: boolean;
  /** Show chat cost in the top bar */
  showChatCost: boolean;

  // Git settings
  /** Branch name prefix option */
  branchNamePrefix: BranchNamePrefix;
  /** Custom branch prefix (when branchNamePrefix is 'custom') */
  customBranchPrefix: string;
  /** Delete local branch when archiving workspace */
  deleteBranchOnArchive: boolean;
  /** Auto-archive workspace after merging PR */
  archiveOnMerge: boolean;

  // Agent model configuration
  /** Model preferences for opencode and cursor agents */
  agentModels: AgentModelConfig;

  /** Available models fetched from agents */
  availableModels: AvailableAgentModels;

  /** Whether we're loading models for an agent */
  isLoadingModels: boolean;

  // Onboarding
  /** Whether the user has completed the first-run onboarding wizard */
  hasCompletedOnboarding: boolean;
  /** Current step in the onboarding wizard (0-3) */
  onboardingStep: number;


  /** Whether GitHub auth token has expired (detected from 401 errors) */
  authExpired: boolean;
  /** API URL for the hatch.sh backend */
  apiUrl: string;

  /** Tracks which keychain keys are set (not persisted — checked fresh on Settings open) */
  keychainStatus: Record<KeychainKey, boolean>;

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

  // Chat settings actions
  setDesktopNotifications: (enabled: boolean) => void;
  setSoundEffects: (enabled: boolean) => void;
  setAutoConvertLongText: (enabled: boolean) => void;
  setStripAbsolutelyRight: (enabled: boolean) => void;
  setShowChatCost: (enabled: boolean) => void;

  // Git settings actions
  setBranchNamePrefix: (prefix: BranchNamePrefix) => void;
  setCustomBranchPrefix: (prefix: string) => void;
  setDeleteBranchOnArchive: (enabled: boolean) => void;
  setArchiveOnMerge: (enabled: boolean) => void;

  // Agent model actions
  setAgentModel: (agent: "opencode" | "cursor", model: string) => void;

  /** Fetch available models from an agent */
  fetchAgentModels: (agent: "opencode" | "cursor") => Promise<ModelInfo[]>;

  /** Check status for a local CLI agent */
  checkAgentStatus: (agentId: LocalAgentId) => Promise<AgentStatus>;

  /** Legacy: Get Claude Code status (for backwards compatibility) */
  get claudeCodeStatus(): AgentStatus | null;

  /** Legacy methods for API key (kept for backward compatibility) */
  setAnthropicApiKey: (key: string | null) => void;
  setApiKeyValidated: (validated: boolean) => void;
  clearApiKey: () => void;

  // API keys actions
  setApiUrl: (url: string) => void;
  refreshKeychainStatus: () => Promise<void>;

  // Onboarding actions
  setOnboardingComplete: () => void;
  setOnboardingStep: (step: number) => void;

  // Legacy setters for backwards compatibility
  setClaudeCodeStatus: (status: AgentStatus | null) => void;
  setIsCheckingClaudeCode: (checking: boolean) => void;

  // Auth expiration actions
  setAuthExpired: (expired: boolean) => void;
  clearAuthExpired: () => void;
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
      agentMode: "claude-code",
      agentStatuses: { ...initialAgentStatuses },
      isCheckingAgent: false,
      isAppReady: false,
      currentPage: "byoa",
      planModeEnabled: false,
      thinkingEnabled: true,

      // Chat settings defaults
      desktopNotifications: true,
      soundEffects: true,
      autoConvertLongText: true,
      stripAbsolutelyRight: true,
      showChatCost: true,

      // Git settings defaults
      branchNamePrefix: "github-username",
      customBranchPrefix: "",
      deleteBranchOnArchive: false,
      archiveOnMerge: false,

      // Agent model defaults
      agentModels: {
        opencode: "default",
        cursor: "default",
      },

      // Available models (fetched dynamically)
      availableModels: {
        opencode: [],
        cursor: [],
      },

      isLoadingModels: false,

      // API keys defaults
      apiUrl: 'http://localhost:8787',
      keychainStatus: {
        anthropic_api_key: false,
        cf_account_id: false,
        cf_api_token: false,
        herenow_api_token: false,
        railway_api_token: false,
      },

      // Onboarding defaults
      hasCompletedOnboarding: false,
      onboardingStep: 0,

      anthropicApiKey: null,
      apiKeyValidated: false,
      authExpired: false,

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

      // Chat settings setters
      setDesktopNotifications: (enabled) => set({ desktopNotifications: enabled }),
      setSoundEffects: (enabled) => set({ soundEffects: enabled }),
      setAutoConvertLongText: (enabled) => set({ autoConvertLongText: enabled }),
      setStripAbsolutelyRight: (enabled) => set({ stripAbsolutelyRight: enabled }),
      setShowChatCost: (enabled) => set({ showChatCost: enabled }),

      // Git settings setters
      setBranchNamePrefix: (prefix) => set({ branchNamePrefix: prefix }),
      setCustomBranchPrefix: (prefix) => set({ customBranchPrefix: prefix }),
      setDeleteBranchOnArchive: (enabled) => set({ deleteBranchOnArchive: enabled }),
      setArchiveOnMerge: (enabled) => set({ archiveOnMerge: enabled }),

      // Agent model setter
      setAgentModel: (agent, model) =>
        set((state) => ({
          agentModels: {
            ...state.agentModels,
            [agent]: model,
          },
        })),

      // Fetch available models from agent
      fetchAgentModels: async (agent) => {
        set({ isLoadingModels: true });
        try {
          const result = await invoke<AvailableModels>("get_agent_models", {
            agentId: agent,
          });

          if (result.success && result.models.length > 0) {
            set((state) => ({
              availableModels: {
                ...state.availableModels,
                [agent]: result.models,
              },
              isLoadingModels: false,
            }));
            return result.models;
          } else {
            // Return empty array if fetch failed
            set({ isLoadingModels: false });
            return [];
          }
        } catch (error) {
          set({ isLoadingModels: false });
          return [];
        }
      },

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

      // API keys actions
      setApiUrl: (url) => set({ apiUrl: url }),
      refreshKeychainStatus: async () => {
        const status: Record<string, boolean> = {}
        for (const key of KEYCHAIN_KEYS) {
          try {
            status[key] = await keychainHas(key)
          } catch {
            status[key] = false
          }
        }
        set({ keychainStatus: status as Record<KeychainKey, boolean> })
      },

      // Onboarding actions
      setOnboardingComplete: () => {
        set({ hasCompletedOnboarding: true, onboardingStep: 0 })
        // Also write a standalone flag — Zustand persist can be unreliable across restarts
        try { localStorage.setItem('hatch-onboarding-done', '1') } catch { /* ignore localStorage errors */ }
      },
      setOnboardingStep: (step) => set({ onboardingStep: step }),

      // Legacy methods
      setAnthropicApiKey: (key) =>
        set({ anthropicApiKey: key, apiKeyValidated: false }),
      setApiKeyValidated: (validated) => set({ apiKeyValidated: validated }),
      clearApiKey: () =>
        set({ anthropicApiKey: null, apiKeyValidated: false }),

      // Auth expiration actions
      setAuthExpired: (expired) => set({ authExpired: expired }),
      clearAuthExpired: () => set({ authExpired: false }),
    }),
    {
      name: "hatch-settings",
      partialize: (state) => ({
        agentMode: state.agentMode,
        planModeEnabled: state.planModeEnabled,
        thinkingEnabled: state.thinkingEnabled,
        // Chat settings
        desktopNotifications: state.desktopNotifications,
        soundEffects: state.soundEffects,
        autoConvertLongText: state.autoConvertLongText,
        stripAbsolutelyRight: state.stripAbsolutelyRight,
        showChatCost: state.showChatCost,
        // Git settings
        branchNamePrefix: state.branchNamePrefix,
        customBranchPrefix: state.customBranchPrefix,
        deleteBranchOnArchive: state.deleteBranchOnArchive,
        archiveOnMerge: state.archiveOnMerge,
        // Agent models
        agentModels: state.agentModels,
        // API URL (not a secret, safe to persist in localStorage)
        apiUrl: state.apiUrl,
        // Onboarding
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        // Don't persist agentStatuses or keychainStatus - always check fresh
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
