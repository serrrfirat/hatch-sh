import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderOpen, Globe, Plus, Loader2, Github, Copy, Check, X } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { useRepositoryStore } from '../../stores/repositoryStore'
import { Plasma } from '../Plasma'

interface WelcomeScreenProps {
  onSendMessage: (message: string) => void
  needsAgent?: boolean
}

type ModalView = 'none' | 'clone' | 'quickstart' | 'github-login'

export function WelcomeScreen({ onSendMessage, needsClaudeCode }: WelcomeScreenProps) {
  const [modalView, setModalView] = useState<ModalView>('none')
  const [cloneUrl, setCloneUrl] = useState('')
  const [repoName, setRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deviceCode, setDeviceCode] = useState<{ userCode: string; verificationUri: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    githubAuth,
    isAuthenticating,
    isCloning,
    cloneProgress,
    cloneRepository,
    openLocalRepository,
    createNewRepository,
    startGitHubLogin,
    completeGitHubLogin,
  } = useRepositoryStore()

  const isAuthenticated = githubAuth?.is_authenticated ?? false

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select a Git repository',
      })

      if (selected) {
        await openLocalRepository(selected as string)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open project')
    }
  }

  const handleCloneSubmit = async () => {
    if (!cloneUrl.trim()) {
      setError('Please enter a repository URL')
      return
    }

    setError(null)

    try {
      await cloneRepository(cloneUrl.trim())
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone repository')
    }
  }

  const handleQuickStartSubmit = async () => {
    if (!repoName.trim()) {
      setError('Please enter a repository name')
      return
    }

    if (!isAuthenticated) {
      setModalView('github-login')
      return
    }

    setError(null)

    try {
      await createNewRepository(repoName.trim(), isPrivate)
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository')
    }
  }

  const handleGitHubLogin = async () => {
    try {
      setError(null)
      const result = await startGitHubLogin()
      setDeviceCode(result)
      completeGitHubLogin(result.userCode)
        .then(() => {
          setDeviceCode(null)
          setModalView('quickstart')
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Login failed')
          setDeviceCode(null)
        })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start login')
    }
  }

  const handleCopyCode = () => {
    if (deviceCode?.userCode) {
      navigator.clipboard.writeText(deviceCode.userCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const closeModal = () => {
    setModalView('none')
    setCloneUrl('')
    setRepoName('')
    setError(null)
    setDeviceCode(null)
  }

  const actionCards = [
    {
      id: 'open',
      icon: FolderOpen,
      label: 'Open project',
      description: 'Open an existing local Git repository',
      onClick: handleOpenProject,
    },
    {
      id: 'clone',
      icon: Globe,
      label: 'Clone from URL',
      description: 'Clone a repository from GitHub',
      onClick: () => setModalView('clone'),
    },
    {
      id: 'quickstart',
      icon: Plus,
      label: 'Quick start',
      description: 'Create a new blank repository',
      onClick: () => setModalView('quickstart'),
    },
  ]

  return (
    <div className="flex flex-col items-center justify-center h-full overflow-hidden bg-neutral-950 px-8 py-12">
      {/* Plasma Logo Area */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl aspect-[3/1] rounded-2xl overflow-hidden bg-black border border-white/10 mb-12"
      >
        <Plasma
          color="#ff6b35"
          speed={0.6}
          direction="forward"
          scale={1.2}
          opacity={0.9}
          mouseInteractive={true}
        />

        {/* Vibed Text Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-white text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter select-none"
            style={{
              textShadow: '0 4px 30px rgba(0,0,0,0.5)'
            }}
          >
            Vibed
          </motion.h1>
        </div>
      </motion.div>

      {/* Action Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="flex gap-4 w-full max-w-2xl"
      >
        {actionCards.map((card, index) => (
          <motion.button
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
            onClick={card.onClick}
            disabled={needsClaudeCode}
            className={`group flex-1 p-5 bg-neutral-900 border border-white/10 rounded-xl hover:border-white/20 hover:bg-neutral-800/50 transition-all duration-200 text-left ${needsClaudeCode ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <card.icon className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">{card.label}</h3>
            <p className="text-xs text-neutral-500">{card.description}</p>
          </motion.button>
        ))}
      </motion.div>

      {/* Claude Code Warning */}
      {needsClaudeCode && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-sm text-amber-500"
        >
          Connect to Claude Code in settings to start building
        </motion.p>
      )}

      {/* Modal Overlay */}
      <AnimatePresence>
        {modalView !== 'none' && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={closeModal}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-96 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            >
              {/* Clone from URL */}
              {modalView === 'clone' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-white">Clone from URL</h3>
                    <button onClick={closeModal} className="text-neutral-500 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="w-full px-4 py-3 bg-neutral-800 border border-white/10 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/20"
                    autoFocus
                  />

                  {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

                  {isCloning && cloneProgress && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-neutral-400">
                      <Loader2 size={16} className="animate-spin" />
                      <span>{cloneProgress}</span>
                    </div>
                  )}

                  <button
                    onClick={handleCloneSubmit}
                    disabled={isCloning || !cloneUrl.trim()}
                    className="mt-6 w-full py-3 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCloning ? 'Cloning...' : 'Clone Repository'}
                  </button>
                </div>
              )}

              {/* Quick Start */}
              {modalView === 'quickstart' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-white">Create new repository</h3>
                    <button onClick={closeModal} className="text-neutral-500 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {!isAuthenticated && (
                    <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-sm text-amber-400">
                        Sign in with GitHub to create repositories
                      </p>
                      <button
                        onClick={() => setModalView('github-login')}
                        className="mt-2 flex items-center gap-2 text-sm text-white hover:underline font-medium"
                      >
                        <Github size={16} />
                        Sign in with GitHub
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="my-awesome-project"
                    className="w-full px-4 py-3 bg-neutral-800 border border-white/10 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/20"
                    autoFocus
                  />

                  <label className="mt-4 flex items-center gap-3 text-sm text-neutral-400">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="w-4 h-4 rounded bg-neutral-800 border-white/20"
                    />
                    Private repository
                  </label>

                  {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

                  <button
                    onClick={handleQuickStartSubmit}
                    disabled={isCloning || !repoName.trim()}
                    className="mt-6 w-full py-3 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCloning ? 'Creating...' : 'Create Repository'}
                  </button>
                </div>
              )}

              {/* GitHub Login */}
              {modalView === 'github-login' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-white">Sign in with GitHub</h3>
                    <button onClick={closeModal} className="text-neutral-500 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {!deviceCode ? (
                    <div className="text-center py-6">
                      <Github size={48} className="mx-auto text-neutral-500 mb-4" />
                      <p className="text-sm text-neutral-400 mb-6">
                        Connect your GitHub account to create and manage repositories
                      </p>
                      <button
                        onClick={handleGitHubLogin}
                        disabled={isAuthenticating}
                        className="px-8 py-3 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition-colors"
                      >
                        {isAuthenticating ? (
                          <span className="flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            Connecting...
                          </span>
                        ) : (
                          'Continue with GitHub'
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-neutral-400 mb-3">
                        Enter this code on GitHub:
                      </p>
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <code className="px-6 py-3 bg-neutral-800 rounded-lg text-2xl font-mono text-white tracking-wider">
                          {deviceCode.userCode}
                        </code>
                        <button
                          onClick={handleCopyCode}
                          className="p-2 text-neutral-500 hover:text-white transition-colors"
                        >
                          {copied ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                      </div>
                      <p className="text-xs text-neutral-500 mb-4">
                        A browser window should have opened. If not, go to:
                        <br />
                        <a
                          href={deviceCode.verificationUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          {deviceCode.verificationUri}
                        </a>
                      </p>
                      <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
                        <Loader2 size={16} className="animate-spin" />
                        Waiting for authorization...
                      </div>
                    </div>
                  )}

                  {error && <p className="mt-3 text-xs text-red-400 text-center">{error}</p>}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
