import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star,
  ChevronDown,
  Check,
  Loader2,
  ExternalLink,
  FolderOpen,
  Globe,
} from 'lucide-react'
import type { Skill } from '../../stores/marketplaceStore'

interface SkillCardProps {
  skill: Skill
  installLocation: 'local' | 'global'
  onInstall: (skill: Skill, location: 'local' | 'global') => void
  onViewDetails: (skill: Skill) => void
  isInstalling?: boolean
  isInstalled?: boolean
}

// Category color dots
const categoryDots: Record<string, string> = {
  documentation: 'bg-violet-400',
  testing: 'bg-pink-400',
  git: 'bg-orange-400',
  database: 'bg-sky-400',
  api: 'bg-green-400',
  devops: 'bg-yellow-400',
  research: 'bg-indigo-400',
  automation: 'bg-cyan-400',
  development: 'bg-emerald-400',
  productivity: 'bg-amber-400',
  'api-backend': 'bg-green-400',
  frontend: 'bg-blue-400',
  security: 'bg-red-400',
  ai: 'bg-purple-400',
}

export function SkillCard({
  skill,
  installLocation,
  onInstall,
  onViewDetails,
  isInstalling = false,
  isInstalled = false,
}: SkillCardProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const primaryCategory = skill.categories[0]
  const dotColor = categoryDots[primaryCategory] || 'bg-neutral-400'

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isInstalled && !isInstalling) {
      onInstall(skill, installLocation)
    }
  }

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDropdown(!showDropdown)
  }

  const handleLocationSelect = (location: 'local' | 'global') => {
    setShowDropdown(false)
    onInstall(skill, location)
  }

  return (
    <motion.div
      className="group relative bg-neutral-900/50 border border-white/5 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:border-white/15 hover:-translate-y-0.5"
      onClick={() => onViewDetails(skill)}
      whileHover={{ scale: 1.005 }}
      layout
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {/* Category dot */}
        <div className={`w-2 h-2 rounded-full mt-2 ${dotColor}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-white tracking-tight truncate">
              {skill.name}
            </h3>
            {skill.trending && (
              <span className="px-1.5 py-0.5 bg-[#00ff88]/10 text-[#00ff88] text-[10px] font-medium uppercase tracking-wider rounded">
                Trending
              </span>
            )}
            {skill.featured && (
              <span className="px-1.5 py-0.5 bg-amber-400/10 text-amber-400 text-[10px] font-medium uppercase tracking-wider rounded">
                Featured
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-neutral-500 font-light leading-relaxed line-clamp-2 mb-4 min-h-[40px]">
        {skill.description}
      </p>

      {/* Category badges */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {skill.categories.slice(0, 3).map((cat) => (
          <span
            key={cat}
            className="px-2 py-0.5 bg-neutral-800 text-neutral-500 text-xs rounded"
          >
            {cat}
          </span>
        ))}
        {skill.categories.length > 3 && (
          <span className="px-2 py-0.5 text-neutral-600 text-xs">
            +{skill.categories.length - 3}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        {/* Author and stars */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-600">
            by{' '}
            <span className="text-neutral-400 hover:text-white transition-colors">
              @{skill.author}
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs text-neutral-600">
            <Star size={12} className="fill-current" />
            {skill.stars}
          </span>
        </div>

        {/* Install button */}
        <div className="relative">
          <div className="flex items-center">
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-xs font-medium transition-all duration-200 ${
                isInstalled
                  ? 'bg-[#00ff88]/10 text-[#00ff88]'
                  : isInstalling
                    ? 'bg-neutral-800 text-neutral-500'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
              }`}
            >
              {isInstalled ? (
                <>
                  <Check size={12} />
                  Installed
                </>
              ) : isInstalling ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Installing
                </>
              ) : (
                <>
                  {installLocation === 'local' ? (
                    <FolderOpen size={12} />
                  ) : (
                    <Globe size={12} />
                  )}
                  Install
                </>
              )}
            </button>

            {!isInstalled && !isInstalling && (
              <button
                onClick={handleDropdownClick}
                className="px-1.5 py-1.5 bg-neutral-800 text-neutral-500 hover:text-white border-l border-neutral-700 rounded-r-lg transition-colors"
              >
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>

          {/* Location dropdown */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 bottom-full mb-2 z-50 p-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl min-w-[140px]"
              >
                <button
                  onClick={() => handleLocationSelect('local')}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors ${
                    installLocation === 'local'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  <FolderOpen size={12} />
                  <span>Local</span>
                  <span className="ml-auto text-neutral-600 text-[10px]">
                    .claude/skills/
                  </span>
                </button>
                <button
                  onClick={() => handleLocationSelect('global')}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors ${
                    installLocation === 'global'
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  <Globe size={12} />
                  <span>Global</span>
                  <span className="ml-auto text-neutral-600 text-[10px]">
                    ~/.claude/skills/
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* GitHub link - appears on hover */}
      <motion.a
        href={skill.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 right-4 p-2 text-neutral-600 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <ExternalLink size={14} />
      </motion.a>
    </motion.div>
  )
}
