import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { IDEPage } from './pages/IDEPage'

function App() {
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
