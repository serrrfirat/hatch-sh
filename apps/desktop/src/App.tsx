import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { IDEPage } from './pages/IDEPage'
import { useSettingsStore, LOCAL_AGENT_IDS } from './stores/settingsStore'

function App() {
  const { checkAgentStatus } = useSettingsStore()

  // Check all local agents on startup (in background)
  useEffect(() => {
    for (const agentId of LOCAL_AGENT_IDS) {
      checkAgentStatus(agentId)
    }
  }, [checkAgentStatus])

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
