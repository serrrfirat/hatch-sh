import { useEffect, useRef } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'

export interface ChatSearchProps {
  query: string
  matchCount: number
  currentMatchIndex: number
  onQueryChange: (q: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

export function ChatSearch({
  query,
  matchCount,
  currentMatchIndex,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
}: ChatSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle Escape key to close search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const hasMatches = matchCount > 0
  const displayIndex = hasMatches ? currentMatchIndex + 1 : 0

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-white/[0.06]">
      {/* Search input */}
      <div className="flex-1 flex items-center gap-2 bg-gray-800 rounded px-3 py-2">
        <svg
          className="w-4 h-4 text-white/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Find in chat..."
          className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
        />
      </div>

      {/* Match count */}
      {query && (
        <span className="text-xs text-white/50 whitespace-nowrap">
          {displayIndex} of {matchCount}
        </span>
      )}

      {/* Navigation buttons */}
      <button
        onClick={onPrevious}
        disabled={!hasMatches}
        className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Previous match (Shift+Enter)"
      >
        <ChevronUp className="w-4 h-4 text-white/60" />
      </button>

      <button
        onClick={onNext}
        disabled={!hasMatches}
        className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Next match (Enter)"
      >
        <ChevronDown className="w-4 h-4 text-white/60" />
      </button>

      {/* Close button */}
      <button
        onClick={onClose}
        className="p-1.5 rounded hover:bg-gray-800 transition-colors"
        title="Close search (Esc)"
      >
        <X className="w-4 h-4 text-white/60" />
      </button>
    </div>
  )
}
