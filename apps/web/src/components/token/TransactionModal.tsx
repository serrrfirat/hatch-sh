import { motion } from 'framer-motion'
import { useTokenStore } from '../../stores/tokenStore'
import { Modal, Button, Confetti } from '@vibed/ui'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TransactionModal({ isOpen, onClose }: TransactionModalProps) {
  const { launchStatus, tokenAddress, txHash, launchError } = useTokenStore()

  const status = launchStatus === 'deploying' || launchStatus === 'launching'
    ? 'pending'
    : launchStatus === 'success'
    ? 'success'
    : launchStatus === 'error'
    ? 'error'
    : 'idle'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Token Launch">
      <div className="text-center py-4">
        {status === 'pending' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-orange/20 flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-accent-orange" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {launchStatus === 'deploying' ? 'Deploying App...' : 'Launching Token...'}
            </h3>
            <p className="text-sm text-gray-500">
              {launchStatus === 'deploying'
                ? 'Your app is being deployed to the cloud'
                : 'Creating your token on the bonding curve'}
            </p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Confetti trigger={status === 'success'} />
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-green/20 flex items-center justify-center">
              <span className="text-3xl">🚀</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">LFG! Token Launched!</h3>
            <p className="text-sm text-gray-500 mb-4">
              Your token is now live on the bonding curve
            </p>
            <div className="p-3 rounded-lg bg-bg-tertiary mb-4">
              <p className="text-xs text-gray-500 mb-1">Token Address</p>
              <p className="text-sm font-mono text-accent-green break-all">{tokenAddress}</p>
            </div>
            {txHash && (
              <div className="p-3 rounded-lg bg-bg-tertiary mb-4">
                <p className="text-xs text-gray-500 mb-1">Transaction</p>
                <p className="text-sm font-mono text-gray-400 break-all truncate">{txHash}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => window.open(`https://sepolia.basescan.org/token/${tokenAddress}`, '_blank')}
              >
                View on BaseScan
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={onClose}
              >
                WAGMI
              </Button>
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-red/20 flex items-center justify-center">
              <span className="text-3xl">😢</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Launch Failed</h3>
            <p className="text-sm text-accent-red mb-4">{launchError}</p>
            <Button variant="secondary" onClick={onClose}>
              Try Again
            </Button>
          </motion.div>
        )}
      </div>
    </Modal>
  )
}
