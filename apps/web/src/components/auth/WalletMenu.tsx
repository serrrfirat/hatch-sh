import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { Button, Badge } from '@vibed/ui'

interface WalletMenuProps {
  onClose: () => void
  onLogout: () => void
}

export function WalletMenu({ onClose, onLogout }: WalletMenuProps) {
  const { wallets, userInfo, linkWallet } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const copyAddress = (walletAddress: string) => {
    navigator.clipboard.writeText(walletAddress)
    // TODO: Show toast
  }

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute right-0 top-full mt-2 w-72 bg-bg-secondary border border-border rounded-xl shadow-xl z-50"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {userInfo?.avatar ? (
            <img src={userInfo.avatar} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-accent-purple" />
          )}
          <div>
            <div className="font-medium text-white">{userInfo?.displayName}</div>
            <div className="text-sm text-gray-500">{userInfo?.email}</div>
          </div>
        </div>
      </div>

      {/* Wallets */}
      <div className="p-4 border-b border-border">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
          Wallets
        </div>
        <div className="space-y-2">
          {(wallets as { address: string; walletClientType?: string }[]).map((wallet) => (
            <div
              key={wallet.address}
              className="flex items-center justify-between p-2 rounded-lg bg-bg-tertiary"
            >
              <div className="flex items-center gap-2">
                <div className="text-sm font-mono text-gray-300">
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </div>
                {wallet.walletClientType === 'privy' && (
                  <Badge variant="info" size="sm">Embedded</Badge>
                )}
              </div>
              <button
                onClick={() => copyAddress(wallet.address)}
                className="text-xs text-gray-500 hover:text-white"
              >
                Copy
              </button>
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2"
          onClick={() => linkWallet()}
        >
          + Link another wallet
        </Button>
      </div>

      {/* Actions */}
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-accent-red hover:bg-accent-red/10"
          onClick={onLogout}
        >
          Disconnect
        </Button>
      </div>
    </motion.div>
  )
}
