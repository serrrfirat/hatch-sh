import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Sparkles, Loader2 } from 'lucide-react'

interface MarketplaceSearchBarProps {
  value: string
  onChange: (value: string) => void
  semanticEnabled: boolean
  onSemanticToggle: (enabled: boolean) => void
  isSearching?: boolean
  placeholder?: string
}

export function MarketplaceSearchBar({
  value,
  onChange,
  semanticEnabled,
  onSemanticToggle,
  isSearching = false,
  placeholder = 'Search skills...',
}: MarketplaceSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 bg-neutral-900/50 border rounded-xl transition-all duration-300 ${
        isFocused
          ? 'border-white/30 shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
          : 'border-white/10 hover:border-white/15'
      }`}
    >
      {/* Search Icon */}
      <div className="flex-shrink-0">
        {isSearching ? (
          <Loader2 size={18} className="text-neutral-500 animate-spin" />
        ) : (
          <Search size={18} className="text-neutral-500" />
        )}
      </div>

      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-neutral-600 text-base font-light tracking-wide"
      />

      {/* Semantic Search Toggle */}
      <button
        onClick={() => onSemanticToggle(!semanticEnabled)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition-all duration-200 ${
          semanticEnabled
            ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30'
            : 'bg-neutral-800 text-neutral-500 border border-transparent hover:text-neutral-300'
        }`}
      >
        <Sparkles size={12} />
        <span>Semantic</span>

        {/* Toggle indicator */}
        <div
          className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${
            semanticEnabled ? 'bg-[#00ff88]/30' : 'bg-neutral-700'
          }`}
        >
          <motion.div
            className={`absolute top-0.5 w-3 h-3 rounded-full ${
              semanticEnabled ? 'bg-[#00ff88]' : 'bg-neutral-500'
            }`}
            animate={{ x: semanticEnabled ? 16 : 2 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
          />
        </div>
      </button>
    </div>
  )
}
