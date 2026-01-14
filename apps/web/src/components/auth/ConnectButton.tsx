import { useAuth } from '../../hooks/useAuth'
import { useState } from 'react'
import { WalletMenu } from './WalletMenu'
import { ChevronDown } from 'lucide-react'

export function ConnectButton() {
  const { ready, authenticated, userInfo, address, login, logout, isConfigured } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  if (!ready) {
    return (
      <button
        disabled
        className="px-2.5 py-1 rounded text-xs font-medium text-neutral-500 bg-neutral-800 border border-white/10"
      >
        Loading...
      </button>
    )
  }

  if (!authenticated) {
    return (
      <button
        onClick={() => login()}
        disabled={!isConfigured}
        title={!isConfigured ? 'Auth not configured - set VITE_PRIVY_APP_ID' : undefined}
        className="px-2.5 py-1 rounded text-xs font-medium bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConfigured ? 'Connect' : 'Connect (Demo)'}
      </button>
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
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-800 border border-white/10 hover:border-white/20 transition-colors"
      >
        {/* Avatar */}
        {userInfo?.avatar ? (
          <img
            src={userInfo.avatar}
            alt=""
            className="w-5 h-5 rounded-full"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500" />
        )}

        {/* Address only */}
        <span className="text-xs text-neutral-300 font-mono">
          {truncatedAddress}
        </span>

        {/* Dropdown arrow */}
        <ChevronDown size={10} className="text-neutral-500" />
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
