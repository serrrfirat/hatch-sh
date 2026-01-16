import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderOpen, Globe, Plus, Loader2, Github, Copy, Check, X } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { useRepositoryStore } from '../../stores/repositoryStore'

interface AddRepositoryMenuProps {
  isOpen: boolean
  onClose: () => void
  position?: { x: number; y: number }
}

type MenuView = 'main' | 'clone' | 'quickstart' | 'github-login'

export function AddRepositoryMenu({ isOpen, onClose, position }: AddRepositoryMenuProps) {
  const [view, setView] = useState<MenuView>('main')
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
        handleClose()
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
      handleClose()
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
      setView('github-login')
      return
    }

    setError(null)

    try {
      await createNewRepository(repoName.trim(), isPrivate)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository')
    }
  }

  const handleGitHubLogin = async () => {
    try {
      setError(null)
      const result = await startGitHubLogin()
      setDeviceCode(result)
      // Start polling for completion
      completeGitHubLogin(result.userCode)
        .then(() => {
          setDeviceCode(null)
          setView('main')
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

  const handleClose = () => {
    setView('main')
    setCloneUrl('')
    setRepoName('')
    setError(null)
    setDeviceCode(null)
    onClose()
  }

  const menuItems = [
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
      onClick: () => setView('clone'),
    },
    {
      id: 'quickstart',
      icon: Plus,
      label: 'Quick start',
      description: 'Create a new blank repository',
      onClick: () => setView('quickstart'),
    },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={handleClose}
          />

          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed z-50 w-80 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            style={position ? { left: position.x, bottom: `calc(100vh - ${position.y}px + 8px)` } : { left: 16, bottom: 60 }}
          >
            {/* Main Menu */}
            {view === 'main' && (
              <div className="py-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <item.icon size={20} className="text-neutral-400 mt-0.5" />
                    <div className="text-left">
                      <div className="text-sm text-white font-medium">{item.label}</div>
                      <div className="text-xs text-neutral-500">{item.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Clone from URL */}
            {view === 'clone' && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white">Clone from URL</h3>
                  <button onClick={() => setView('main')} className="text-neutral-500 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <input
                  type="text"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full px-3 py-2 bg-neutral-800 border border-white/10 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/20"
                  autoFocus
                />

                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

                {isCloning && cloneProgress && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{cloneProgress}</span>
                  </div>
                )}

                <button
                  onClick={handleCloneSubmit}
                  disabled={isCloning || !cloneUrl.trim()}
                  className="mt-4 w-full py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCloning ? 'Cloning...' : 'Clone Repository'}
                </button>
              </div>
            )}

            {/* Quick Start */}
            {view === 'quickstart' && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white">Create new repository</h3>
                  <button onClick={() => setView('main')} className="text-neutral-500 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                {!isAuthenticated && (
                  <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-xs text-yellow-500">
                      Sign in with GitHub to create repositories
                    </p>
                    <button
                      onClick={() => setView('github-login')}
                      className="mt-2 flex items-center gap-2 text-xs text-white hover:underline"
                    >
                      <Github size={14} />
                      Sign in with GitHub
                    </button>
                  </div>
                )}

                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-awesome-project"
                  className="w-full px-3 py-2 bg-neutral-800 border border-white/10 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/20"
                  autoFocus
                />

                <label className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-4 h-4 rounded bg-neutral-800 border-white/20"
                  />
                  Private repository
                </label>

                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

                <button
                  onClick={handleQuickStartSubmit}
                  disabled={isCloning || !repoName.trim()}
                  className="mt-4 w-full py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCloning ? 'Creating...' : 'Create Repository'}
                </button>
              </div>
            )}

            {/* GitHub Login */}
            {view === 'github-login' && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white">Sign in with GitHub</h3>
                  <button onClick={() => setView('main')} className="text-neutral-500 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                {!deviceCode ? (
                  <div className="text-center py-4">
                    <Github size={40} className="mx-auto text-neutral-400 mb-4" />
                    <p className="text-sm text-neutral-400 mb-4">
                      Connect your GitHub account to create and manage repositories
                    </p>
                    <button
                      onClick={handleGitHubLogin}
                      disabled={isAuthenticating}
                      className="px-6 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition-colors"
                    >
                      {isAuthenticating ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          Connecting...
                        </span>
                      ) : (
                        'Continue with GitHub'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-neutral-400 mb-2">
                      Enter this code on GitHub:
                    </p>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <code className="px-4 py-2 bg-neutral-800 rounded-lg text-xl font-mono text-white tracking-wider">
                        {deviceCode.userCode}
                      </code>
                      <button
                        onClick={handleCopyCode}
                        className="p-2 text-neutral-500 hover:text-white transition-colors"
                      >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
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
                    <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
                      <Loader2 size={14} className="animate-spin" />
                      Waiting for authorization...
                    </div>
                  </div>
                )}

                {error && <p className="mt-2 text-xs text-red-400 text-center">{error}</p>}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
