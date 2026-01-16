import { useProjectStore } from '../../stores/projectStore'
import { Coins, Rocket, Wallet } from 'lucide-react'

export function TokenPanel() {
  const { currentProject } = useProjectStore()

  const isDeployed = currentProject?.status === 'deployed' || currentProject?.status === 'launched'

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
          <Coins size={14} />
          Token
        </h3>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {!currentProject?.code && (
          <div className="text-neutral-500">
            <Coins size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Generate code to get started</p>
          </div>
        )}

        {currentProject?.code && !isDeployed && (
          <div className="text-neutral-500">
            <Rocket size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm mb-4">Deploy your app to launch a token</p>
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors">
              Deploy App
            </button>
          </div>
        )}

        {isDeployed && (
          <div className="text-neutral-500">
            <Wallet size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm mb-4">Connect wallet to launch token</p>
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors">
              Connect Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
