import { motion } from 'framer-motion'
import { Terminal, CheckCircle, Loader2, ArrowUpRight } from 'lucide-react'
import type { AgentStatus, AgentConfig } from '../lib/agents/types'

interface StartupScreenProps {
  status: 'checking' | 'connected' | 'not-installed' | 'not-authenticated' | 'error'
  agentStatus?: AgentStatus | null
  agentConfig?: AgentConfig
  onContinue?: () => void
  onRetry?: () => void
}

// Letter-by-letter stagger animation (from Bold Editorial style)
const letterAnim = {
  initial: { y: "100%", opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
}

const containerAnim = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    }
  }
}

function AnimatedTitle() {
  const title = "hatch.sh"

  return (
    <h1 className="text-[12vw] leading-none font-bold tracking-tighter mb-4 select-none flex justify-center overflow-hidden py-[2vw]">
      <motion.div
        variants={containerAnim}
        initial="initial"
        animate="animate"
        className="flex"
      >
        {title.split('').map((char, i) => (
          <motion.span key={i} variants={letterAnim} className="inline-block relative">
            {char}
          </motion.span>
        ))}
        <motion.span
          variants={letterAnim}
          className="text-2xl align-top ml-2 font-normal inline-block mt-[2vw]"
        >
          &reg;
        </motion.span>
      </motion.div>
    </h1>
  )
}

export function StartupScreen({
  status,
  agentStatus,
  agentConfig,
  onContinue,
  onRetry
}: StartupScreenProps) {
  // Use agent-specific names or fall back to generic
  const agentName = agentConfig?.name || 'your local agent'
  const downloadUrl = agentConfig?.installUrl || 'https://claude.ai/download'
  const authCommand = agentConfig?.authCommand || 'claude login'

  return (
    <div className="fixed inset-0 bg-white text-black font-sans selection:bg-black selection:text-white flex flex-col items-center justify-center">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center pt-20">
        <div className="w-full px-4 text-center">
          <AnimatedTitle />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="text-xl md:text-2xl text-neutral-600 font-medium tracking-tight mt-8"
          >
            Connecting to {agentName}
          </motion.p>
        </div>
      </section>

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="mt-16 bg-neutral-50 border border-black/10 rounded-sm p-8 max-w-md w-full mx-4"
      >
        <div className="flex items-center gap-4 mb-6 border-b border-black/10 pb-6">
          <div className={`p-3 rounded-sm ${
            status === 'checking' ? 'bg-neutral-200' :
            status === 'connected' ? 'bg-black' :
            'bg-neutral-200'
          }`}>
            {status === 'checking' ? (
              <Loader2 className="w-5 h-5 text-neutral-600 animate-spin" />
            ) : status === 'connected' ? (
              <CheckCircle className="w-5 h-5 text-white" />
            ) : (
              <Terminal className="w-5 h-5 text-neutral-600" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-medium tracking-tight text-black">
              {status === 'checking' && 'Connecting...'}
              {status === 'connected' && 'Connected'}
              {status === 'not-installed' && 'Not Installed'}
              {status === 'not-authenticated' && 'Authentication Required'}
              {status === 'error' && 'Connection Error'}
            </h2>
            <p className="text-neutral-500 text-sm">
              {status === 'checking' && `Checking ${agentName}`}
              {status === 'connected' && agentStatus?.version && `Version ${agentStatus.version}`}
              {status === 'connected' && !agentStatus?.version && 'Ready to use'}
              {status === 'not-installed' && `${agentName} is required`}
              {status === 'not-authenticated' && 'Please authenticate'}
              {status === 'error' && (agentStatus?.error || 'Something went wrong')}
            </p>
          </div>
        </div>

        {/* Instructions based on status */}
        {status === 'not-installed' && (
          <div className="space-y-4">
            <p className="text-neutral-600 text-sm">
              BYOA mode requires {agentName} to be installed on your machine.
            </p>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between w-full py-3 px-4 bg-black hover:bg-neutral-800 text-white rounded-sm font-medium transition-colors"
            >
              <span>Download {agentName}</span>
              <ArrowUpRight size={18} className="opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
            </a>
            <button
              onClick={onRetry}
              className="w-full py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-sm font-medium transition-colors border border-black/10"
            >
              Check Again
            </button>
          </div>
        )}

        {status === 'not-authenticated' && (
          <div className="space-y-4">
            <p className="text-neutral-600 text-sm">
              Run the following command in your terminal:
            </p>
            <code className="block w-full py-3 px-4 bg-neutral-100 text-black rounded-sm font-mono text-sm border border-black/10">
              {authCommand}
            </code>
            <button
              onClick={onRetry}
              className="w-full py-3 px-4 bg-black hover:bg-neutral-800 text-white rounded-sm font-medium transition-colors"
            >
              Check Again
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <button
              onClick={onRetry}
              className="w-full py-3 px-4 bg-black hover:bg-neutral-800 text-white rounded-sm font-medium transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {status === 'connected' && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={onContinue}
            className="group flex items-center justify-between w-full py-3 px-4 bg-black hover:bg-neutral-800 text-white rounded-sm font-medium transition-colors"
          >
            <span>Continue to App</span>
            <ArrowUpRight size={18} className="opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
          </motion.button>
        )}
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="mt-12 text-neutral-400 text-sm font-mono uppercase tracking-wider"
      >
        Bring Your Own Agent
      </motion.p>
    </div>
  )
}
