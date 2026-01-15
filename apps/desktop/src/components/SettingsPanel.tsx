import { useEffect } from "react";
import { useSettingsStore, type AgentMode } from "../stores/settingsStore";
import { checkClaudeCodeStatus } from "../lib/claudeCode/bridge";
import { CheckCircle2, XCircle, Loader2, Terminal, ExternalLink, RefreshCw } from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    agentMode,
    claudeCodeStatus,
    isCheckingClaudeCode,
    setAgentMode,
    setClaudeCodeStatus,
    setIsCheckingClaudeCode,
  } = useSettingsStore();

  // Check Claude Code status when switching to BYOA mode or opening settings
  useEffect(() => {
    if (isOpen && agentMode === "byoa" && !claudeCodeStatus) {
      checkConnection();
    }
  }, [isOpen, agentMode]);

  const handleModeChange = (mode: AgentMode) => {
    setAgentMode(mode);
    if (mode === "byoa" && !claudeCodeStatus) {
      checkConnection();
    }
  };

  const checkConnection = async () => {
    setIsCheckingClaudeCode(true);
    try {
      const status = await checkClaudeCodeStatus();
      setClaudeCodeStatus({
        ...status,
        lastChecked: Date.now(),
      });
    } catch (error) {
      setClaudeCodeStatus({
        installed: false,
        authenticated: false,
        error: error instanceof Error ? error.message : "Failed to check Claude Code status",
        lastChecked: Date.now(),
      });
    }
  };

  const openClaudeDownload = () => {
    // Open Claude Code download page
    window.open("https://claude.ai/download", "_blank");
  };

  if (!isOpen) return null;

  const isConnected = claudeCodeStatus?.installed && claudeCodeStatus?.authenticated;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-lg p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Agent Mode Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Agent Mode</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleModeChange("cloud")}
              className={`p-4 rounded-lg border transition-all ${
                agentMode === "cloud"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  agentMode === "cloud" ? "border-blue-500 bg-blue-500" : "border-zinc-500"
                }`} />
                <div className="text-left">
                  <div className="text-sm font-medium text-white">Cloud</div>
                  <div className="text-xs text-zinc-400">Use vibed.fun credits</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleModeChange("byoa")}
              className={`p-4 rounded-lg border transition-all ${
                agentMode === "byoa"
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  agentMode === "byoa" ? "border-purple-500 bg-purple-500" : "border-zinc-500"
                }`} />
                <div className="text-left">
                  <div className="text-sm font-medium text-white">BYOA</div>
                  <div className="text-xs text-zinc-400">Use Claude Code</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Claude Code Connection (only show for BYOA mode) */}
        {agentMode === "byoa" && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Claude Code Connection
            </h3>

            {/* Status Card */}
            <div className={`rounded-lg border p-4 mb-4 ${
              isCheckingClaudeCode
                ? "border-zinc-700 bg-zinc-800/50"
                : isConnected
                ? "border-green-500/50 bg-green-500/10"
                : "border-red-500/50 bg-red-500/10"
            }`}>
              {isCheckingClaudeCode ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <span className="text-zinc-300">Checking Claude Code...</span>
                </div>
              ) : isConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-green-400 font-medium">Connected</span>
                  </div>
                  {claudeCodeStatus?.version && (
                    <p className="text-xs text-zinc-400 ml-7">
                      Version: {claudeCodeStatus.version}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-400 font-medium">Not Connected</span>
                  </div>
                  {claudeCodeStatus?.error && (
                    <p className="text-xs text-red-300/80 ml-7">
                      {claudeCodeStatus.error}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={checkConnection}
                disabled={isCheckingClaudeCode}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isCheckingClaudeCode ? "animate-spin" : ""}`} />
                {isCheckingClaudeCode ? "Checking..." : "Check Connection"}
              </button>

              {!claudeCodeStatus?.installed && (
                <button
                  onClick={openClaudeDownload}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Download Claude Code
                </button>
              )}

              {claudeCodeStatus?.installed && !claudeCodeStatus?.authenticated && (
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-start gap-2 text-sm text-zinc-300">
                    <Terminal className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium mb-1">Login Required</p>
                      <p className="text-zinc-400 text-xs">
                        Open your terminal and run:
                      </p>
                      <code className="block mt-2 bg-zinc-900 px-2 py-1 rounded text-xs text-purple-400">
                        claude login
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
          ) : (
            <div className="text-sm text-zinc-400">
              <p className="font-medium text-white mb-1">BYOA Mode (Bring Your Own Agent)</p>
              <p>
                Use your local Claude Code installation with your Claude Max/Pro
                subscription. Unlimited usage with your own account.
              </p>
            </div>
          )}
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
