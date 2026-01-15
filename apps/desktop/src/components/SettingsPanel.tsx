import { useEffect } from "react";
import { useSettingsStore, type AgentMode, AGENT_IDS } from "../stores/settingsStore";
import type { AgentId, AgentStatus } from "../lib/agents/types";
import { AGENT_CONFIGS } from "../lib/agents/registry";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  ExternalLink,
  RefreshCw,
  Cloud,
} from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Agent card component for selecting and configuring an agent */
function AgentCard({
  agentId,
  isSelected,
  onSelect,
  status,
  isChecking,
}: {
  agentId: AgentId;
  isSelected: boolean;
  onSelect: () => void;
  status: AgentStatus | null;
  isChecking: boolean;
}) {
  const config = AGENT_CONFIGS[agentId];
  const isConnected = status?.installed && status?.authenticated;

  // Agent-specific colors
  const colorMap: Record<AgentId, { border: string; bg: string; dot: string }> = {
    "claude-code": {
      border: "border-purple-500",
      bg: "bg-purple-500/10",
      dot: "border-purple-500 bg-purple-500",
    },
    opencode: {
      border: "border-emerald-500",
      bg: "bg-emerald-500/10",
      dot: "border-emerald-500 bg-emerald-500",
    },
    cursor: {
      border: "border-cyan-500",
      bg: "bg-cyan-500/10",
      dot: "border-cyan-500 bg-cyan-500",
    },
  };

  const colors = colorMap[agentId];

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg border transition-all cursor-pointer ${
        isSelected ? `${colors.border} ${colors.bg}` : "border-zinc-700 hover:border-zinc-600"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`w-4 h-4 rounded-full border-2 ${
            isSelected ? colors.dot : "border-zinc-500"
          }`}
        />
        <div className="text-left flex-1">
          <div className="text-sm font-medium text-white">{config.name}</div>
          <div className="text-xs text-zinc-400">{config.description}</div>
        </div>
      </div>

      {/* Status indicator when selected */}
      {isSelected && (
        <div className="mt-3 pt-3 border-t border-zinc-700/50">
          {isChecking ? (
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Checking...</span>
            </div>
          ) : isConnected ? (
            <div className="flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle2 className="w-3 h-3" />
              <span>
                Connected{status.version ? ` (${status.version})` : ""}
              </span>
            </div>
          ) : status?.installed && !status?.authenticated ? (
            <div className="flex items-center gap-2 text-yellow-400 text-xs">
              <XCircle className="w-3 h-3" />
              <span>Not authenticated</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <XCircle className="w-3 h-3" />
              <span>Not installed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    agentMode,
    agentStatuses,
    isCheckingAgent,
    setAgentMode,
    checkAgentStatus,
  } = useSettingsStore();

  // Check agent status when switching to a local agent or opening settings
  useEffect(() => {
    if (isOpen && agentMode !== "cloud") {
      const agentId = agentMode as AgentId;
      if (!agentStatuses[agentId]) {
        checkAgentStatus(agentId);
      }
    }
  }, [isOpen, agentMode, agentStatuses, checkAgentStatus]);

  const handleModeChange = (mode: AgentMode) => {
    setAgentMode(mode);
    if (mode !== "cloud") {
      const agentId = mode as AgentId;
      if (!agentStatuses[agentId]) {
        checkAgentStatus(agentId);
      }
    }
  };

  const handleCheckConnection = () => {
    if (agentMode !== "cloud") {
      checkAgentStatus(agentMode as AgentId);
    }
  };

  const currentStatus =
    agentMode !== "cloud" ? agentStatuses[agentMode as AgentId] : null;
  const currentConfig =
    agentMode !== "cloud" ? AGENT_CONFIGS[agentMode as AgentId] : null;

  if (!isOpen) return null;

  const isConnected = currentStatus?.installed && currentStatus?.authenticated;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Agent Mode Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Agent Mode</h3>

          {/* Cloud option */}
          <div
            onClick={() => handleModeChange("cloud")}
            className={`p-4 rounded-lg border transition-all cursor-pointer mb-3 ${
              agentMode === "cloud"
                ? "border-blue-500 bg-blue-500/10"
                : "border-zinc-700 hover:border-zinc-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full border-2 ${
                  agentMode === "cloud"
                    ? "border-blue-500 bg-blue-500"
                    : "border-zinc-500"
                }`}
              />
              <Cloud className="w-4 h-4 text-zinc-400" />
              <div className="text-left">
                <div className="text-sm font-medium text-white">Cloud</div>
                <div className="text-xs text-zinc-400">
                  Use vibed.fun credits
                </div>
              </div>
            </div>
          </div>

          {/* Local agent options */}
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 mt-4">
            Bring Your Own Agent
          </p>
          <div className="grid grid-cols-1 gap-3">
            {AGENT_IDS.map((agentId) => (
              <AgentCard
                key={agentId}
                agentId={agentId}
                isSelected={agentMode === agentId}
                onSelect={() => handleModeChange(agentId)}
                status={agentStatuses[agentId]}
                isChecking={isCheckingAgent && agentMode === agentId}
              />
            ))}
          </div>
        </div>

        {/* Agent Connection Panel (only show for local agents) */}
        {agentMode !== "cloud" && currentConfig && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              {currentConfig.name} Connection
            </h3>

            {/* Status Card */}
            <div
              className={`rounded-lg border p-4 mb-4 ${
                isCheckingAgent
                  ? "border-zinc-700 bg-zinc-800/50"
                  : isConnected
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-red-500/50 bg-red-500/10"
              }`}
            >
              {isCheckingAgent ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <span className="text-zinc-300">
                    Checking {currentConfig.name}...
                  </span>
                </div>
              ) : isConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-green-400 font-medium">Connected</span>
                  </div>
                  {currentStatus?.version && (
                    <p className="text-xs text-zinc-400 ml-7">
                      Version: {currentStatus.version}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-400 font-medium">
                      Not Connected
                    </span>
                  </div>
                  {currentStatus?.error && (
                    <p className="text-xs text-red-300/80 ml-7">
                      {currentStatus.error}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleCheckConnection}
                disabled={isCheckingAgent}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isCheckingAgent ? "animate-spin" : ""}`}
                />
                {isCheckingAgent ? "Checking..." : "Check Connection"}
              </button>

              {!currentStatus?.installed && (
                <a
                  href={currentConfig.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Download {currentConfig.name}
                </a>
              )}

              {currentStatus?.installed && !currentStatus?.authenticated && (
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-start gap-2 text-sm text-zinc-300">
                    <Terminal className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium mb-1">Login Required</p>
                      <p className="text-zinc-400 text-xs">
                        Open your terminal and run:
                      </p>
                      <code className="block mt-2 bg-zinc-900 px-2 py-1 rounded text-xs text-purple-400">
                        {currentConfig.authCommand}
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode Description */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          {agentMode === "cloud" ? (
            <div className="text-sm text-zinc-400">
              <p className="font-medium text-white mb-1">Cloud Mode</p>
              <p>
                Your requests are processed through vibed.fun servers using our
                Claude API credits. Simple and ready to use.
              </p>
            </div>
          ) : currentConfig ? (
            <div className="text-sm text-zinc-400">
              <p className="font-medium text-white mb-1">
                {currentConfig.name} Mode
              </p>
              <p>
                Use your local {currentConfig.name} installation with your own
                subscription. Unlimited usage with your own account.
              </p>
            </div>
          ) : null}
        </div>

        {/* Close Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
