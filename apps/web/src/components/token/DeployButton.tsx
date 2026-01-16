import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTokenLaunch } from '../../hooks/useTokenLaunch'
import { useTokenStore } from '../../stores/tokenStore'
import { useProjectStore } from '../../stores/projectStore'
import { Button } from '@vibed/ui'
import { TransactionModal } from './TransactionModal'

export function DeployButton() {
  const { formData, launchStatus, deployAndLaunch, deployOnly, isDeployed, isLaunched } = useTokenLaunch()
  const { launchError } = useTokenStore()
  const { currentProject } = useProjectStore()
  const [showTxModal, setShowTxModal] = useState(false)

  // Determine button state
  const getButtonConfig = () => {
    if (!currentProject?.code) {
      return { text: 'Generate code first', disabled: true, variant: 'secondary' as const }
    }

    if (launchStatus === 'deploying') {
      return { text: 'Deploying...', disabled: true, variant: 'primary' as const, loading: true }
    }

    if (launchStatus === 'launching') {
      return { text: 'Launching...', disabled: true, variant: 'primary' as const, loading: true }
    }

    if (isLaunched) {
      return { text: 'Token Launched', disabled: true, variant: 'secondary' as const }
    }

    if (!isDeployed) {
      return { text: 'Deploy App', disabled: false, variant: 'primary' as const, action: 'deploy' }
    }

    if (!formData.name || !formData.symbol) {
      return { text: 'Fill token details above', disabled: true, variant: 'secondary' as const }
    }

    return { text: 'Deploy & Launch Token', disabled: false, variant: 'primary' as const, action: 'launch' }
  }

  const config = getButtonConfig()

  const handleClick = async () => {
    if (config.action === 'deploy') {
      await deployOnly()
    } else if (config.action === 'launch') {
      setShowTxModal(true)
      await deployAndLaunch()
    }
  }

  return (
    <>
      <motion.div
        whileHover={!config.disabled ? { scale: 1.02 } : undefined}
        whileTap={!config.disabled ? { scale: 0.98 } : undefined}
      >
        <Button
          variant={config.variant}
          size="lg"
          className={`w-full font-bold ${config.variant === 'primary' && !config.disabled ? 'animate-pulse' : ''}`}
          disabled={config.disabled}
          onClick={handleClick}
        >
          {config.loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {config.text}
            </span>
          ) : (
            config.text
          )}
        </Button>
      </motion.div>

      {launchError && launchStatus === 'error' && (
        <p className="text-sm text-accent-red mt-2 text-center">{launchError}</p>
      )}

      <TransactionModal
        isOpen={showTxModal}
        onClose={() => setShowTxModal(false)}
      />
    </>
  )
}
