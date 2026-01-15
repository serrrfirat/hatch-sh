import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { IDEPage } from './pages/IDEPage'
import { StartupScreen } from './components/StartupScreen'
import { useSettingsStore } from './stores/settingsStore'
import { checkClaudeCodeStatus } from './lib/claudeCode/bridge'

type StartupStatus = 'checking' | 'connected' | 'not-installed' | 'not-authenticated' | 'error'

function App() {
  const { agentMode, claudeCodeStatus, isAppReady, setClaudeCodeStatus, setAppReady } = useSettingsStore()
  const [startupStatus, setStartupStatus] = useState<StartupStatus>('checking')

  // Check Claude Code on startup for BYOA mode
  useEffect(() => {
    if (agentMode === 'cloud') {
      // Cloud mode doesn't need Claude Code
      setAppReady(true)
      return
    }

    // BYOA mode - check Claude Code status
    checkConnection()
  }, [agentMode])

  const checkConnection = async () => {
    setStartupStatus('checking')
    try {
      const status = await checkClaudeCodeStatus()
      setClaudeCodeStatus(status)

      if (!status.installed) {
        setStartupStatus('not-installed')
      } else if (!status.authenticated) {
        setStartupStatus('not-authenticated')
      } else {
        setStartupStatus('connected')
      }
    } catch {
      setStartupStatus('error')
    }
  }

  const handleContinue = () => {
    setAppReady(true)
  }

  // Show startup screen for BYOA mode until ready
  if (agentMode === 'byoa' && !isAppReady) {
    return (
      <StartupScreen
        status={startupStatus}
        claudeCodeStatus={claudeCodeStatus}
        onContinue={handleContinue}
        onRetry={checkConnection}
      />
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<IDEPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
