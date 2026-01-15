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
  Plus,
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

  // Agent-specific accent colors (muted, editorial style)
  const colorMap: Record<LocalAgentId, { accent: string; accentMuted: string }> = {
    "claude-code": {
      accent: "text-violet-400",
      accentMuted: "border-violet-400/30",
    },
    opencode: {
      accent: "text-emerald-400",
      accentMuted: "border-emerald-400/30",
    },
    cursor: {
      accent: "text-sky-400",
      accentMuted: "border-sky-400/30",
    },
  };

  const colors = colorMap[agentId];

  return (
    <div className="group relative bg-neutral-900/50 border border-white/5 hover:border-white/10 transition-all duration-500 p-6">
      <div className="flex items-start gap-4">
        {/* Accent dot */}
        <div className={`w-2 h-2 rounded-full mt-2 ${colors.accent.replace('text-', 'bg-')}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-medium tracking-tight text-white">
              {config.name}
            </h4>
            <button
              onClick={onCheck}
              disabled={isChecking}
              className="p-2 text-neutral-500 hover:text-white transition-colors duration-300 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
            </button>
          </div>
          <p className="text-sm text-neutral-500 mt-1 font-light">
            {config.description}
          </p>

          {/* Status */}
          <div className="mt-4 flex items-center gap-2">
            {isChecking ? (
              <span className="text-xs text-neutral-500 tracking-wide uppercase font-mono flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking
              </span>
            ) : isConnected ? (
              <span className={`text-xs tracking-wide uppercase font-mono flex items-center gap-2 ${colors.accent}`}>
                <CheckCircle2 className="w-3 h-3" />
                Connected{status?.version ? ` (${status.version})` : ""}
              </span>
            ) : status?.installed && !status?.authenticated ? (
              <span className="text-xs text-amber-400/80 tracking-wide uppercase font-mono flex items-center gap-2">
                <XCircle className="w-3 h-3" />
                Not authenticated
              </span>
            ) : (
              <span className="text-xs text-neutral-600 tracking-wide uppercase font-mono flex items-center gap-2">
                <XCircle className="w-3 h-3" />
                Not installed
              </span>
            )}
          </div>

          {/* Setup instructions */}
          {!status?.installed && (
            <a
              href={config.installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-neutral-400 hover:text-white transition-colors duration-300"
            >
              <ExternalLink className="w-3 h-3" />
              Download {config.name}
            </a>
          )}

          {status?.installed && !status?.authenticated && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="flex items-start gap-3">
                <Terminal className="w-4 h-4 text-neutral-600 mt-0.5" />
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider font-mono mb-2">Run in terminal</p>
                  <code className={`text-sm ${colors.accent}`}>
                    {config.authCommand}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-black border border-white/10 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto selection:bg-white selection:text-black">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-white/5">
          <h2 className="text-3xl font-bold tracking-tighter text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-white transition-colors duration-300 hover:rotate-90"
          >
            <Plus className="w-6 h-6 rotate-45" strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Local Agents Section */}
          <div className="mb-10">
            <div className="flex items-end justify-between mb-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-xl font-medium tracking-tight text-white mb-1">
                  Local Agents (BYOA)
                </h3>
                <p className="text-sm text-neutral-500 font-light max-w-md">
                  Configure local CLI agents for use in your workspaces. Select an agent per workspace using the dropdown above the chat input.
                </p>
              </div>
              <span className="hidden md:block font-mono text-xs text-neutral-600">
                ( _{String(LOCAL_AGENT_IDS.length).padStart(2, '0')} )
              </span>
            </div>
            <div className="space-y-3">
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
          <div className="border-t border-white/5 pt-8">
            <h4 className="text-sm font-medium text-white mb-3 tracking-tight">
              Per-Workspace Agent Selection
            </h4>
            <p className="text-sm text-neutral-500 font-light leading-relaxed">
              Each workspace can use a different agent or model. Use the dropdown
              in the chat area to select which agent to use for the current workspace.
              Cloud models use vibed.fun credits, while local agents use your own subscriptions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 pt-0 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white text-black font-medium py-3 px-8 text-sm tracking-wide uppercase hover:bg-neutral-200 transition-colors duration-300"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
