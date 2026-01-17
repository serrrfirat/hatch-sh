import { Panel, PanelHeader, PanelContent } from '@hatch/ui'
import { useTokenStore } from '../../stores/tokenStore'
import { useProjectStore } from '../../stores/projectStore'
import { TokenForm } from './TokenForm'
import { TokenStats } from './TokenStats'
import { DeployButton } from './DeployButton'

export function TokenPanel() {
  const { tokenAddress } = useTokenStore()
  const { currentProject } = useProjectStore()

  const isDeployed = currentProject?.status === 'deployed' || currentProject?.status === 'launched'
  const showLaunchForm = isDeployed && !tokenAddress
  const showStats = !!tokenAddress

  return (
    <Panel className="h-full flex flex-col">
      <PanelHeader>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Token
        </h3>
      </PanelHeader>

      <PanelContent className="flex-1 flex flex-col">
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!currentProject?.code && (
            <div className="text-center py-8 text-gray-600">
              <p className="text-sm">Generate code to get started</p>
            </div>
          )}

          {currentProject?.code && !isDeployed && (
            <div className="text-center py-8 text-gray-600">
              <p className="text-sm">Deploy your app to launch a token</p>
            </div>
          )}

          {showLaunchForm && <TokenForm />}
          {showStats && <TokenStats tokenAddress={tokenAddress} />}
        </div>

        {/* Footer with Deploy/Launch button */}
        <div className="border-t border-border pt-4 mt-auto">
          <DeployButton />
        </div>
      </PanelContent>
    </Panel>
  )
}
