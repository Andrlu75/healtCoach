import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import Layout from './components/common/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import OnboardingEditor from './pages/OnboardingEditor'
import Reports from './pages/Reports'
import Invites from './pages/Invites'
import AISettings from './pages/settings/AISettings'
import TelegramSettings from './pages/settings/TelegramSettings'
import PersonaSettings from './pages/settings/PersonaSettings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="onboarding" element={<OnboardingEditor />} />
          <Route path="reports" element={<Reports />} />
          <Route path="invites" element={<Invites />} />
          <Route path="settings/ai" element={<AISettings />} />
          <Route path="settings/telegram" element={<TelegramSettings />} />
          <Route path="settings/persona" element={<PersonaSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
