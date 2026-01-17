import { useEffect, useState, useCallback } from "react";
import { useSettingsStore, LOCAL_AGENT_IDS } from "../stores/settingsStore";
import type { AgentStatus, LocalAgentId, ModelInfo } from "../lib/agents/types";
import type { BranchNamePrefix } from "../stores/settingsStore";
import { AGENT_CONFIGS } from "../lib/agents/registry";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  GitBranch,
  Bot,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";

type SettingsTab = "chat" | "git" | "agents";

/** Toggle switch component */
function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        enabled ? "bg-emerald-500" : "bg-neutral-700"
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/** Setting row with label, description, and toggle */
function SettingRow({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-white/5 last:border-b-0">
      <div className="flex-1 pr-4">
        <div className="text-sm font-medium text-white">{label}</div>
        {description && (
          <div className="text-xs text-neutral-500 mt-1">{description}</div>
        )}
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

/** Radio option component */
function RadioOption({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex items-start gap-3 w-full text-left py-2"
    >
      <div
        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
          selected ? "border-emerald-500 bg-emerald-500" : "border-neutral-600"
        }`}
      >
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
      <div>
        <div className="text-sm text-white">{label}</div>
        {description && (
          <div className="text-xs text-neutral-500 mt-0.5">{description}</div>
        )}
      </div>
    </button>
  );
}

/** Dropdown select component */
function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-white/20 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
      />
    </div>
  );
}

/** Chat settings tab content */
function ChatSettings() {
  const {
    planModeEnabled,
    setPlanModeEnabled,
    thinkingEnabled,
    setThinkingEnabled,
    desktopNotifications,
    setDesktopNotifications,
    soundEffects,
    setSoundEffects,
    autoConvertLongText,
    setAutoConvertLongText,
    stripAbsolutelyRight,
    setStripAbsolutelyRight,
    showChatCost,
    setShowChatCost,
  } = useSettingsStore();

  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-4">Chat</h3>
      <div className="space-y-0">
        <SettingRow
          label="Default to plan mode"
          description="Start new chats in plan mode (Claude only)"
          enabled={planModeEnabled}
          onChange={setPlanModeEnabled}
        />
        <SettingRow
          label="Show extended thinking"
          description="Display Claude's reasoning process in chat"
          enabled={thinkingEnabled}
          onChange={setThinkingEnabled}
        />
        <SettingRow
          label="Desktop notifications"
          description="Get notified when AI finishes working in a chat"
          enabled={desktopNotifications}
          onChange={setDesktopNotifications}
        />
        <SettingRow
          label="Sound effects"
          description="Play a sound when AI finishes working in a chat"
          enabled={soundEffects}
          onChange={setSoundEffects}
        />
        <SettingRow
          label="Auto-convert long text"
          description="Convert pasted text over 5000 characters into text attachments"
          enabled={autoConvertLongText}
          onChange={setAutoConvertLongText}
        />
        <SettingRow
          label="I'm not absolutely right, thank you very much"
          description={`Strip "You're absolutely right!" from AI messages`}
          enabled={stripAbsolutelyRight}
          onChange={setStripAbsolutelyRight}
        />
        <SettingRow
          label="Show chat cost"
          description="Display chat cost in the top bar"
          enabled={showChatCost}
          onChange={setShowChatCost}
        />
      </div>
    </div>
  );
}

/** Git settings tab content */
function GitSettings() {
  const {
    branchNamePrefix,
    setBranchNamePrefix,
    customBranchPrefix,
    setCustomBranchPrefix,
    deleteBranchOnArchive,
    setDeleteBranchOnArchive,
    archiveOnMerge,
    setArchiveOnMerge,
  } = useSettingsStore();

  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-4">Git</h3>

      {/* Branch name prefix */}
      <div className="mb-6">
        <div className="text-sm font-medium text-white mb-1">
          Branch name prefix
        </div>
        <div className="text-xs text-neutral-500 mb-3">
          Prefix for new workspace branch names. Will be followed by a slash.
        </div>
        <div className="space-y-1">
          <RadioOption
            label="GitHub username (serrrfirat)"
            selected={branchNamePrefix === "github-username"}
            onSelect={() => setBranchNamePrefix("github-username")}
          />
          <RadioOption
            label="Custom"
            selected={branchNamePrefix === "custom"}
            onSelect={() => setBranchNamePrefix("custom")}
          />
          {branchNamePrefix === "custom" && (
            <input
              type="text"
              value={customBranchPrefix}
              onChange={(e) => setCustomBranchPrefix(e.target.value)}
              placeholder="Enter custom prefix"
              className="ml-7 mt-2 w-full max-w-xs bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20"
            />
          )}
          <RadioOption
            label="None"
            selected={branchNamePrefix === "none"}
            onSelect={() => setBranchNamePrefix("none")}
          />
        </div>
      </div>

      <div className="border-t border-white/5 pt-4 space-y-0">
        <SettingRow
          label="Delete branch on archive"
          description="Delete the local branch when archiving a workspace"
          enabled={deleteBranchOnArchive}
          onChange={setDeleteBranchOnArchive}
        />
        <SettingRow
          label="Archive on merge"
          description="Automatically archive a workspace after merging its PR"
          enabled={archiveOnMerge}
          onChange={setArchiveOnMerge}
        />
      </div>
    </div>
  );
}

/** Agent card component for checking and configuring a local agent */
function LocalAgentCard({
  agentId,
  status,
  isChecking,
  onCheck,
}: {
  agentId: LocalAgentId;
  status: AgentStatus | null;
  isChecking: boolean;
  onCheck: () => void;
}) {
  const config = AGENT_CONFIGS[agentId];
  const isConnected = status?.installed && status?.authenticated;

  const colorMap: Record<LocalAgentId, { accent: string }> = {
    "claude-code": { accent: "text-violet-400" },
    opencode: { accent: "text-emerald-400" },
    cursor: { accent: "text-sky-400" },
  };

  const colors = colorMap[agentId];

  return (
    <div className="bg-neutral-900/50 border border-white/5 rounded-lg p-4 mb-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`w-2 h-2 rounded-full mt-2 ${colors.accent.replace("text-", "bg-")}`}
          />
          <div>
            <h4 className="text-sm font-medium text-white">{config.name}</h4>
            <p className="text-xs text-neutral-500 mt-0.5">
              {config.description}
            </p>
          </div>
        </div>
        <button
          onClick={onCheck}
          disabled={isChecking}
          className="p-1.5 text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-3 ml-5">
        {isChecking ? (
          <span className="text-xs text-neutral-500 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Checking...
          </span>
        ) : isConnected ? (
          <span className={`text-xs flex items-center gap-1.5 ${colors.accent}`}>
            <CheckCircle2 className="w-3 h-3" />
            Connected{status?.version ? ` (${status.version})` : ""}
          </span>
        ) : status?.installed && !status?.authenticated ? (
          <div>
            <span className="text-xs text-amber-400/80 flex items-center gap-1.5">
              <XCircle className="w-3 h-3" />
              Not authenticated
            </span>
            <div className="mt-2 flex items-start gap-2">
              <Terminal className="w-3 h-3 text-neutral-600 mt-0.5" />
              <code className={`text-xs ${colors.accent}`}>
                {config.authCommand}
              </code>
            </div>
          </div>
        ) : (
          <div>
            <span className="text-xs text-neutral-600 flex items-center gap-1.5">
              <XCircle className="w-3 h-3" />
              Not installed
            </span>
            <a
              href={config.installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Download {config.name}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** Model selector for an agent */
function AgentModelSelector({
  agent,
  currentModel,
  availableModels,
  isLoading,
  onChange,
}: {
  agent: "opencode" | "cursor";
  currentModel: string;
  availableModels: ModelInfo[];
  isLoading: boolean;
  onChange: (model: string) => void;
}) {
  // Build options from available models
  const modelOptions: { value: string; label: string }[] = [
    { value: "default", label: "Default (Agent's choice)" },
    ...availableModels.map((model) => ({
      value: model.id,
      label: model.name + (model.provider ? ` (${model.provider})` : ""),
    })),
  ];

  const agentName = agent === "opencode" ? "Opencode" : "Cursor";

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0">
      <div>
        <div className="text-sm font-medium text-white">{agentName} model</div>
        <div className="text-xs text-neutral-500 mt-0.5">
          Model to use when running {agentName} agent
        </div>
      </div>
      {isLoading ? (
        <span className="text-xs text-neutral-500 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading models...
        </span>
      ) : (
        <Select
          value={currentModel}
          options={modelOptions}
          onChange={onChange}
        />
      )}
    </div>
  );
}

/** Agents settings tab content */
function AgentsSettings() {
  const {
    agentStatuses,
    isCheckingAgent,
    checkAgentStatus,
    agentModels,
    setAgentModel,
    availableModels,
    isLoadingModels,
    fetchAgentModels,
  } = useSettingsStore();

  const [modelsFetched, setModelsFetched] = useState(false);

  // Check status for all agents when opening this tab
  useEffect(() => {
    for (const agentId of LOCAL_AGENT_IDS) {
      if (!agentStatuses[agentId]) {
        checkAgentStatus(agentId);
      }
    }
  }, [agentStatuses, checkAgentStatus]);

  // Fetch models once on mount (separate effect to avoid dependency issues)
  useEffect(() => {
    if (!modelsFetched) {
      const fetchModels = async () => {
        // Always try to fetch - the Rust side handles the case where agent isn't installed
        await Promise.all([
          fetchAgentModels("opencode"),
          fetchAgentModels("cursor"),
        ]);
        setModelsFetched(true);
      };
      fetchModels();
    }
  }, [fetchAgentModels, modelsFetched]);

  // Refetch models when agent becomes installed
  const handleRefetchModels = useCallback(async (agent: "opencode" | "cursor") => {
    await fetchAgentModels(agent);
  }, [fetchAgentModels]);

  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-4">Agents</h3>

      {/* Agent status section */}
      <div className="mb-6">
        <div className="text-sm font-medium text-white mb-1">
          Local Agents (BYOA)
        </div>
        <div className="text-xs text-neutral-500 mb-3">
          Configure local CLI agents for use in your workspaces.
        </div>
        <div>
          {LOCAL_AGENT_IDS.map((agentId) => (
            <LocalAgentCard
              key={agentId}
              agentId={agentId}
              status={agentStatuses[agentId]}
              isChecking={isCheckingAgent}
              onCheck={() => {
                checkAgentStatus(agentId);
                // Refetch models after status check for applicable agents
                if (agentId === "opencode" || agentId === "cursor") {
                  setTimeout(() => handleRefetchModels(agentId), 500);
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Model configuration section */}
      <div className="border-t border-white/5 pt-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium text-white">
            Model Configuration
          </div>
          <button
            onClick={() => {
              handleRefetchModels("opencode");
              handleRefetchModels("cursor");
            }}
            disabled={isLoadingModels}
            className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingModels ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="text-xs text-neutral-500 mb-3">
          Choose which model each agent should use. Models are fetched from the
          installed agents.
        </div>
        <div className="space-y-0">
          <AgentModelSelector
            agent="opencode"
            currentModel={agentModels.opencode}
            availableModels={availableModels.opencode}
            isLoading={isLoadingModels && availableModels.opencode.length === 0}
            onChange={(model) => setAgentModel("opencode", model)}
          />
          <AgentModelSelector
            agent="cursor"
            currentModel={agentModels.cursor}
            availableModels={availableModels.cursor}
            isLoading={isLoadingModels && availableModels.cursor.length === 0}
            onChange={(model) => setAgentModel("cursor", model)}
          />
        </div>
      </div>

      {/* Info section */}
      <div className="mt-6 p-4 bg-neutral-900/50 border border-white/5 rounded-lg">
        <div className="text-xs text-neutral-500">
          <strong className="text-neutral-400">Per-Workspace Selection:</strong>{" "}
          Each workspace can use a different agent. Use the dropdown in the chat
          area to select which agent to use for the current workspace.
        </div>
      </div>
    </div>
  );
}

/** Full-page Settings component */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("chat");
  const { setCurrentPage } = useSettingsStore();

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "chat", label: "Chat", icon: <MessageSquare size={18} /> },
    { id: "git", label: "Git", icon: <GitBranch size={18} /> },
    { id: "agents", label: "Agents", icon: <Bot size={18} /> },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10 bg-neutral-900/50">
        <button
          onClick={() => setCurrentPage('byoa')}
          className="p-2 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r border-white/10 bg-neutral-900/30 p-4 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-8">
            {activeTab === "chat" && <ChatSettings />}
            {activeTab === "git" && <GitSettings />}
            {activeTab === "agents" && <AgentsSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}
