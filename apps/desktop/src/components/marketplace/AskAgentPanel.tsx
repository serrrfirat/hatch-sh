import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  ChevronUp,
  ChevronDown,
  Loader2,
  X,
  ArrowRight,
} from 'lucide-react'
import type { Skill } from '../../stores/marketplaceStore'

interface AskAgentPanelProps {
  onAnalyze: () => void
  isAnalyzing: boolean
  suggestions?: Skill[]
  onInstallSuggestion: (skill: Skill) => void
  onClearSuggestions?: () => void
}

export function AskAgentPanel({
  onAnalyze,
  isAnalyzing,
  suggestions = [],
  onInstallSuggestion,
  onClearSuggestions,
}: AskAgentPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring', bounce: 0.3 }}
      className="fixed bottom-6 right-6 z-40 max-w-sm"
    >
      <div className="bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300">
        {/* Header - always visible */}
        <div
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Animated sparkles icon */}
          <div className="relative">
            <motion.div
              animate={isAnalyzing ? { rotate: 360 } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles
                size={20}
                className={`transition-colors ${isAnalyzing ? 'text-[#00ff88]' : 'text-neutral-400'}`}
              />
            </motion.div>
            {!isAnalyzing && (
              <motion.div
                className="absolute inset-0 bg-[#00ff88]/20 rounded-full blur-md"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            )}
          </div>

          <div className="flex-1">
            <h4 className="text-sm font-medium text-white">Ask Agent</h4>
            <p className="text-xs text-neutral-500">
              What skills would help this project?
            </p>
          </div>

          <button className="p-1 text-neutral-500 hover:text-white transition-colors">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsDismissed(true)
            }}
            className="p-1 text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-4 pb-4 border-t border-white/5 pt-4">
                {/* Analyze button */}
                {suggestions.length === 0 && (
                  <button
                    onClick={onAnalyze}
                    disabled={isAnalyzing}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isAnalyzing
                        ? 'bg-neutral-800 text-neutral-500 cursor-wait'
                        : 'bg-[#00ff88] text-black hover:bg-[#00ff88]/90 active:scale-[0.98]'
                    }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Analyzing codebase...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Analyze & Suggest
                      </>
                    )}
                  </button>
                )}

                {/* Suggestions list */}
                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500 uppercase tracking-wider font-mono mb-3">
                      Suggested Skills
                    </p>
                    {suggestions.map((skill, index) => (
                      <motion.div
                        key={skill.id}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg group hover:bg-neutral-800 transition-colors"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">
                            {skill.name}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">
                            {skill.categories[0]}
                          </p>
                        </div>
                        <button
                          onClick={() => onInstallSuggestion(skill)}
                          className="p-1.5 text-neutral-500 hover:text-[#00ff88] opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <ArrowRight size={14} />
                        </button>
                      </motion.div>
                    ))}

                    {/* Reset button */}
                    <button
                      onClick={onClearSuggestions}
                      className="w-full mt-2 py-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                      Analyze again
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
