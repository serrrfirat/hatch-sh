import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './providers/AuthProvider'
import { Layout } from './components/layout/Layout'
import { IDEPage } from './pages/IDEPage'
import { MarketplacePage } from './pages/MarketplacePage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<IDEPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
