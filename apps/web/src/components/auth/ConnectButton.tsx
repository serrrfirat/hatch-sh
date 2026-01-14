import { useAuth } from '../../hooks/useAuth'
import { Button } from '@vibed/ui'
import { useState } from 'react'
import { WalletMenu } from './WalletMenu'

export function ConnectButton() {
  const { ready, authenticated, userInfo, address, login, logout, isConfigured } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  if (!ready) {
    return (
      <Button variant="secondary" disabled>
        Loading...
      </Button>
    )
  }

  if (!authenticated) {
    return (
      <Button
        variant="primary"
        onClick={() => login()}
        disabled={!isConfigured}
        title={!isConfigured ? 'Auth not configured - set VITE_PRIVY_APP_ID' : undefined}
      >
        {isConfigured ? 'Connect' : 'Connect (Demo)'}
      </Button>
    )
  }

  // Truncate address
  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ''

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary border border-border hover:border-accent-green transition-all"
      >
        {/* Avatar */}
        {userInfo?.avatar ? (
          <img
            src={userInfo.avatar}
            alt=""
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-accent-purple" />
        )}

        {/* User info */}
        <div className="text-left">
          <div className="text-sm font-medium text-white">
            {userInfo?.displayName}
          </div>
          <div className="text-xs text-gray-500">
            {truncatedAddress}
          </div>
        </div>

        {/* Dropdown arrow */}
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <WalletMenu
          onClose={() => setShowMenu(false)}
          onLogout={logout}
        />
      )}
    </div>
  )
}
