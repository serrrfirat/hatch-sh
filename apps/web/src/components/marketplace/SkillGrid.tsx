import { motion } from 'framer-motion'
import { SkillCard } from './SkillCard'
import type { Skill } from '../../stores/marketplaceStore'

interface SkillGridProps {
  skills: Skill[]
  installLocation: 'local' | 'global'
  onInstall: (skill: Skill, location: 'local' | 'global') => void
  onViewDetails: (skill: Skill) => void
  installingIds: Set<string>
  installedIds: Set<string>
  isLoading?: boolean
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      bounce: 0.3,
      duration: 0.6,
    },
  },
}

export function SkillGrid({
  skills,
  installLocation,
  onInstall,
  onViewDetails,
  installingIds,
  installedIds,
  isLoading = false,
}: SkillGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-neutral-900/50 border border-white/5 rounded-xl p-6 animate-pulse"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-neutral-800 mt-2" />
              <div className="flex-1">
                <div className="h-5 bg-neutral-800 rounded w-2/3 mb-2" />
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-3 bg-neutral-800 rounded w-full" />
              <div className="h-3 bg-neutral-800 rounded w-4/5" />
            </div>
            <div className="flex gap-2 mb-4">
              <div className="h-5 bg-neutral-800 rounded w-16" />
              <div className="h-5 bg-neutral-800 rounded w-12" />
            </div>
            <div className="pt-4 border-t border-white/5 flex justify-between">
              <div className="h-4 bg-neutral-800 rounded w-20" />
              <div className="h-7 bg-neutral-800 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
          <span className="text-2xl">0</span>
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No skills found</h3>
        <p className="text-sm text-neutral-500 max-w-md">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {skills.map((skill) => (
        <motion.div key={skill.id} variants={itemVariants}>
          <SkillCard
            skill={skill}
            installLocation={installLocation}
            onInstall={onInstall}
            onViewDetails={onViewDetails}
            isInstalling={installingIds.has(skill.id)}
            isInstalled={installedIds.has(skill.id)}
          />
        </motion.div>
      ))}
    </motion.div>
  )
}
