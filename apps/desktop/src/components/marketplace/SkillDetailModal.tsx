import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Star,
  ExternalLink,
  Copy,
  Check,
  FolderOpen,
  Globe,
  Loader2,
} from 'lucide-react'
import type { Skill } from '../../stores/marketplaceStore'

interface SkillDetailModalProps {
  skill: Skill | null
  isOpen: boolean
  onClose: () => void
  onInstall: (skill: Skill, location: 'local' | 'global') => void
  installLocation: 'local' | 'global'
  onInstallLocationChange: (location: 'local' | 'global') => void
  isInstalling?: boolean
  isInstalled?: boolean
}

export function SkillDetailModal({
  skill,
  isOpen,
  onClose,
  onInstall,
  installLocation,
  onInstallLocationChange,
  isInstalling = false,
  isInstalled = false,
}: SkillDetailModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  useEffect(() => {
    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleCopy = async () => {
    if (skill) {
      await navigator.clipboard.writeText(skill.installCommand)
      setCopied(true)
    }
  }

  const handleInstall = async () => {
    if (skill && !isInstalling && !isInstalled) {
      onInstall(skill, installLocation)
    }
  }

  if (!skill) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            className="relative max-w-2xl w-full max-h-[85vh] bg-black border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-white/5">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {skill.name}
                  </h2>
                  {skill.trending && (
                    <span className="px-2 py-0.5 bg-[#00ff88]/10 text-[#00ff88] text-xs font-medium uppercase tracking-wider rounded">
                      Trending
                    </span>
                  )}
                  {skill.featured && (
                    <span className="px-2 py-0.5 bg-amber-400/10 text-amber-400 text-xs font-medium uppercase tracking-wider rounded">
                      Featured
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-neutral-500">
                    by <span className="text-neutral-300">@{skill.author}</span>
                  </span>
                  <span className="flex items-center gap-1 text-neutral-500">
                    <Star size={12} className="fill-current text-amber-400" />
                    {skill.stars}
                  </span>
                  <a
                    href={skill.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-neutral-500 hover:text-white transition-colors"
                  >
                    <ExternalLink size={12} />
                    GitHub
                  </a>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-neutral-500 hover:text-white transition-colors hover:rotate-90 duration-300"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Description */}
              <p className="text-neutral-400 leading-relaxed mb-6">
                {skill.description}
              </p>

              {/* Categories */}
              <div className="flex flex-wrap gap-2 mb-6">
                {skill.categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-3 py-1 bg-neutral-900 text-neutral-400 text-sm rounded-full border border-neutral-800"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {/* Install command */}
              <div className="mb-6">
                <label className="block text-xs text-neutral-500 uppercase tracking-wider font-mono mb-2">
                  Install Command
                </label>
                <div className="flex items-center gap-2 p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                  <code className="flex-1 text-sm text-[#00ff88] font-mono break-all">
                    {skill.installCommand}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="p-2 text-neutral-500 hover:text-white transition-colors flex-shrink-0"
                  >
                    {copied ? (
                      <Check size={16} className="text-[#00ff88]" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* SKILL.md content */}
              {skill.skillMdContent && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <label className="block text-xs text-neutral-500 uppercase tracking-wider font-mono mb-2">
                    README
                  </label>
                  <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-neutral-400 whitespace-pre-wrap font-mono">
                    {skill.skillMdContent}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-white/5 bg-neutral-950/50">
              {/* Install location toggle */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500 uppercase tracking-wider">
                  Install to:
                </span>
                <div className="flex items-center p-1 bg-neutral-900 rounded-lg border border-neutral-800">
                  <button
                    onClick={() => onInstallLocationChange('local')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      installLocation === 'local'
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <FolderOpen size={12} />
                    Local
                  </button>
                  <button
                    onClick={() => onInstallLocationChange('global')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      installLocation === 'global'
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <Globe size={12} />
                    Global
                  </button>
                </div>
              </div>

              {/* Install button */}
              <button
                onClick={handleInstall}
                disabled={isInstalling || isInstalled}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isInstalled
                    ? 'bg-[#00ff88]/10 text-[#00ff88] cursor-default'
                    : isInstalling
                      ? 'bg-neutral-800 text-neutral-500 cursor-wait'
                      : 'bg-white text-black hover:bg-neutral-200 active:scale-[0.98]'
                }`}
              >
                {isInstalled ? (
                  <>
                    <Check size={16} />
                    Installed
                  </>
                ) : isInstalling ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    {installLocation === 'local' ? (
                      <FolderOpen size={16} />
                    ) : (
                      <Globe size={16} />
                    )}
                    Install Skill
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
