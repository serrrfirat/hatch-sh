import { useEffect } from "react";
import { useSettingsStore, LOCAL_AGENT_IDS } from "../stores/settingsStore";
import type { AgentStatus, LocalAgentId } from "../lib/agents/types";
import { AGENT_CONFIGS } from "../lib/agents/registry";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
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

  // Agent-specific colors
  const colorMap: Record<LocalAgentId, { border: string; bg: string; dot: string }> = {
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
      className={`p-4 rounded-lg border transition-all ${colors.border} ${colors.bg}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`w-4 h-4 rounded-full border-2 ${colors.dot}`}
        />
        <div className="text-left flex-1">
          <div className="text-sm font-medium text-white">{config.name}</div>
          <div className="text-xs text-zinc-400">{config.description}</div>
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-3 pt-3 border-t border-zinc-700/50 flex items-center justify-between">
        <div>
          {isChecking ? (
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Checking...</span>
            </div>
          ) : isConnected ? (
            <div className="flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle2 className="w-3 h-3" />
              <span>
                Connected{status?.version ? ` (${status.version})` : ""}
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
        <button
          onClick={onCheck}
          disabled={isChecking}
          className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Setup instructions */}
      {!status?.installed && (
        <div className="mt-3">
          <a
            href={config.installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
          >
            <ExternalLink className="w-3 h-3" />
            Download {config.name}
          </a>
        </div>
      )}

      {status?.installed && !status?.authenticated && (
        <div className="mt-3 bg-zinc-800/50 rounded p-2">
          <div className="flex items-start gap-2 text-xs text-zinc-300">
            <Terminal className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-zinc-400">Run in terminal:</p>
              <code className="block mt-1 text-purple-400">
                {config.authCommand}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    agentStatuses,
    isCheckingAgent,
    checkAgentStatus,
  } = useSettingsStore();

  // Check status for all local agents when opening settings
  useEffect(() => {
    if (isOpen) {
      for (const agentId of LOCAL_AGENT_IDS) {
        if (!agentStatuses[agentId]) {
          checkAgentStatus(agentId);
        }
      }
    }
  }, [isOpen, agentStatuses, checkAgentStatus]);

  if (!isOpen) return null;

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

        {/* Local Agents Configuration */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">
            Local Agents (BYOA)
          </h3>
          <p className="text-xs text-zinc-500 mb-4">
            Configure local CLI agents for use in your workspaces. Select an agent per workspace using the dropdown above the chat input.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {LOCAL_AGENT_IDS.map((agentId) => (
              <LocalAgentCard
                key={agentId}
                agentId={agentId}
                status={agentStatuses[agentId]}
                isChecking={isCheckingAgent}
                onCheck={() => checkAgentStatus(agentId)}
              />
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="text-sm text-zinc-400">
            <p className="font-medium text-white mb-1">Per-Workspace Agent Selection</p>
            <p>
              Each workspace can use a different agent or model. Use the dropdown
              in the chat area to select which agent to use for the current workspace.
              Cloud models use vibed.fun credits, while local agents use your own subscriptions.
            </p>
          </div>
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
