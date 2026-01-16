import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderOpen, Globe, Info } from 'lucide-react'

interface InstallLocationToggleProps {
  value: 'local' | 'global'
  onChange: (value: 'local' | 'global') => void
  className?: string
}

export function InstallLocationToggle({
  value,
  onChange,
  className = '',
}: InstallLocationToggleProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {/* Toggle container */}
      <div className="relative flex items-center p-1 bg-neutral-900 rounded-lg border border-white/10">
        {/* Animated background pill */}
        <motion.div
          className="absolute h-[calc(100%-8px)] bg-neutral-800 rounded-md"
          initial={false}
          animate={{
            x: value === 'local' ? 4 : 'calc(100% - 4px)',
            width: value === 'local' ? 70 : 75,
          }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />

        {/* Local button */}
        <button
          onClick={() => onChange('local')}
          className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 ${
            value === 'local' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <FolderOpen size={12} />
          <span>Local</span>
        </button>

        {/* Global button */}
        <button
          onClick={() => onChange('global')}
          className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 ${
            value === 'global' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Globe size={12} />
          <span>Global</span>
        </button>
      </div>

      {/* Info icon with tooltip */}
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Info
          size={14}
          className="text-neutral-600 hover:text-neutral-400 cursor-help transition-colors"
        />

        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 p-3 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl w-64"
            >
              <p className="text-xs text-neutral-400 leading-relaxed">
                <strong className="text-white">Local:</strong> Saves to{' '}
                <code className="text-[#00ff88] bg-neutral-800 px-1 rounded">
                  .claude/skills/
                </code>{' '}
                in your project.
              </p>
              <p className="text-xs text-neutral-400 leading-relaxed mt-2">
                <strong className="text-white">Global:</strong> Saves to{' '}
                <code className="text-[#00ff88] bg-neutral-800 px-1 rounded">
                  ~/.claude/skills/
                </code>{' '}
                for all projects.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
