import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GitBranch, FolderGit2, Loader2, Check, FileCode2 } from 'lucide-react'
import type { Workspace } from '../../stores/repositoryStore'
import type { Repository } from '../../lib/git/bridge'

interface WorkspaceInitScreenProps {
  workspace: Workspace
  repository: Repository | null
  onReady?: () => void
}

interface InitStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed'
  icon: typeof GitBranch
}

export function WorkspaceInitScreen({ workspace, repository, onReady }: WorkspaceInitScreenProps) {
  const [steps, setSteps] = useState<InitStep[]>([
    { id: 'branch', label: `Branched from origin/${repository?.default_branch || 'master'}`, status: 'completed', icon: GitBranch },
    { id: 'create', label: `Created ${workspace.branchName}`, status: 'completed', icon: FolderGit2 },
    { id: 'detect', label: 'Detecting setup script...', status: 'running', icon: FileCode2 },
  ])

  // Simulate step completion
  useEffect(() => {
    const timer = setTimeout(() => {
      setSteps(prev => prev.map(step =>
        step.id === 'detect' ? { ...step, status: 'completed' as const, label: 'Ready to build' } : step
      ))
      onReady?.()
    }, 2000)

    return () => clearTimeout(timer)
  }, [onReady])

  const repoName = repository?.name || workspace.branchName.split('-')[0] || 'workspace'

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-white/10 bg-neutral-900/50 px-6 py-4"
      >
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-neutral-400" />
          <span className="text-sm text-neutral-300">
            You're in a new copy of your codebase called{' '}
            <code className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-mono">
              {repoName}
            </code>
          </span>
        </div>
      </motion.div>

      {/* Init Steps */}
      <div className="flex-1 flex flex-col items-start justify-start p-6 max-w-2xl">
        <div className="space-y-4 w-full">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15 }}
              className="flex items-center gap-3"
            >
              {/* Status Icon */}
              <div className={`w-6 h-6 flex items-center justify-center rounded-full ${
                step.status === 'completed'
                  ? 'bg-emerald-500/20'
                  : step.status === 'running'
                    ? 'bg-amber-500/20'
                    : 'bg-neutral-800'
              }`}>
                {step.status === 'completed' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : step.status === 'running' ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                ) : (
                  <step.icon className="w-3.5 h-3.5 text-neutral-500" />
                )}
              </div>

              {/* Step Label */}
              <span className={`text-sm ${
                step.status === 'completed'
                  ? 'text-neutral-300'
                  : step.status === 'running'
                    ? 'text-neutral-200'
                    : 'text-neutral-500'
              }`}>
                {step.status === 'running' && step.id === 'detect' ? (
                  <>
                    <span className="text-neutral-400">↻</span>{' '}
                    {step.label}
                  </>
                ) : (
                  <>
                    {step.status === 'completed' && step.id !== 'detect' && (
                      <span className="text-neutral-500 mr-1">
                        {step.id === 'branch' ? '⇄' : '⊕'}
                      </span>
                    )}
                    {step.label}
                    {step.id === 'create' && (
                      <span className="text-neutral-500"> and copying.</span>
                    )}
                  </>
                )}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
