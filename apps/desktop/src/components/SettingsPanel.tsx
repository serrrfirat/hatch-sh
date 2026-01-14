import { useState } from "react";
import { useSettingsStore, type AgentMode } from "../stores/settingsStore";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    agentMode,
    anthropicApiKey,
    apiKeyValidated,
    setAgentMode,
    setAnthropicApiKey,
    setApiKeyValidated,
    clearApiKey,
  } = useSettingsStore();

  const [apiKeyInput, setApiKeyInput] = useState(anthropicApiKey || "");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleModeChange = (mode: AgentMode) => {
    setAgentMode(mode);
    setValidationError(null);
  };

  const validateApiKey = async () => {
    if (!apiKeyInput.trim()) {
      setValidationError("Please enter an API key");
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      // Simple validation: check if key starts with correct prefix
      if (!apiKeyInput.startsWith("sk-ant-")) {
        throw new Error("Invalid API key format. Should start with 'sk-ant-'");
      }

      // In production, you'd make a test API call to validate
      // For now, we'll just check the format
      setAnthropicApiKey(apiKeyInput);
      setApiKeyValidated(true);
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : "Validation failed"
      );
      setApiKeyValidated(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearApiKey = () => {
    setApiKeyInput("");
    clearApiKey();
    setValidationError(null);
  };

  if (!isOpen) return null;

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
                  <div className="text-xs text-zinc-400">Use your API key</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* API Key Configuration (only show for BYOA mode) */}
        {agentMode === "byoa" && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Anthropic API Key
            </h3>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
                {apiKeyValidated && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>

              {validationError && (
                <p className="text-sm text-red-400">{validationError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={validateApiKey}
                  disabled={isValidating}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isValidating ? "Validating..." : "Save API Key"}
                </button>
                {anthropicApiKey && (
                  <button
                    onClick={handleClearApiKey}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <p className="text-xs text-zinc-500">
                Get your API key from{" "}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300"
                >
                  console.anthropic.com
                </a>
              </p>
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
                Use your own Anthropic API key for unlimited usage. Your API key
                is stored locally and never sent to our servers.
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
