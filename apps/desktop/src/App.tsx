import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { IDEPage } from './pages/IDEPage'
import { StartupScreen } from './components/StartupScreen'
import { useSettingsStore } from './stores/settingsStore'
import type { AgentId } from './lib/agents/types'
import { getConfig } from './lib/agents/registry'

type StartupStatus = 'checking' | 'connected' | 'not-installed' | 'not-authenticated' | 'error'

function App() {
  const {
    agentMode,
    agentStatuses,
    isAppReady,
    setAppReady,
    checkAgentStatus
  } = useSettingsStore()
  const [startupStatus, setStartupStatus] = useState<StartupStatus>('checking')

  // Get current agent's status and config
  const currentAgentId = agentMode !== 'cloud' ? (agentMode as AgentId) : null
  const currentStatus = currentAgentId ? agentStatuses[currentAgentId] : null
  const currentConfig = currentAgentId ? getConfig(currentAgentId) : undefined

  // Check agent on startup for local agent modes
  useEffect(() => {
    if (agentMode === 'cloud') {
      // Cloud mode doesn't need local agent
      setAppReady(true)
      return
    }

    // Local agent mode - check agent status
    checkConnection()
  }, [agentMode])

  const checkConnection = async () => {
    if (!currentAgentId) return

    setStartupStatus('checking')
    try {
      const status = await checkAgentStatus(currentAgentId)

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

  // Show startup screen for local agent modes until ready
  if (agentMode !== 'cloud' && !isAppReady) {
    return (
      <StartupScreen
        status={startupStatus}
        agentStatus={currentStatus}
        agentConfig={currentConfig}
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
