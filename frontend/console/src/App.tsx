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
import Logs from './pages/Logs'
import NutritionPrograms from './pages/NutritionPrograms'
import NutritionProgramEdit from './pages/NutritionProgramEdit'
import NutritionProgramStats from './pages/NutritionProgramStats'
import AISettings from './pages/settings/AISettings'
import TelegramSettings from './pages/settings/TelegramSettings'
import PersonaSettings from './pages/settings/PersonaSettings'
import AccountSettings from './pages/settings/AccountSettings'
// FitDB (тренировки)
import FitdbIndex from './pages/fitdb/Index'
import FitdbDashboard from './pages/fitdb/Dashboard'
import FitdbWorkouts from './pages/fitdb/Workouts'
import FitdbWorkoutBuilder from './pages/fitdb/WorkoutBuilder'
import FitdbTemplates from './pages/fitdb/WorkoutTemplates'
import FitdbTemplateBuilder from './pages/fitdb/TemplateBuilder'
import FitdbClients from './pages/fitdb/Clients'
import FitdbClientDetail from './pages/fitdb/ClientDetail'
import FitdbWorkoutRun from './pages/fitdb/WorkoutRun'
import FitdbWorkoutHistory from './pages/fitdb/WorkoutHistory'
// MiniApp demo
import MiniAppDemo from './pages/miniapp'

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
          <Route path="nutrition-programs" element={<NutritionPrograms />} />
          <Route path="nutrition-programs/new" element={<NutritionProgramEdit />} />
          <Route path="nutrition-programs/:id" element={<NutritionProgramEdit />} />
          <Route path="nutrition-programs/:id/stats" element={<NutritionProgramStats />} />
          {/* Остальное */}
          <Route path="onboarding" element={<OnboardingEditor />} />
          <Route path="logs" element={<Logs />} />
          <Route path="reports" element={<Reports />} />
          <Route path="invites" element={<Invites />} />
          <Route path="settings/ai" element={<AISettings />} />
          <Route path="settings/telegram" element={<TelegramSettings />} />
          <Route path="settings/persona" element={<PersonaSettings />} />
          <Route path="settings/account" element={<AccountSettings />} />
          {/* Тренировки (FitDB) */}
          <Route path="fitdb" element={<FitdbIndex />} />
          <Route path="fitdb/dashboard" element={<FitdbDashboard />} />
          <Route path="fitdb/workouts" element={<FitdbWorkouts />} />
          <Route path="fitdb/workouts/new" element={<FitdbWorkoutBuilder />} />
          <Route path="fitdb/workouts/:id" element={<FitdbWorkoutBuilder />} />
          <Route path="fitdb/workouts/:id/run" element={<FitdbWorkoutRun />} />
          <Route path="fitdb/templates" element={<FitdbTemplates />} />
          <Route path="fitdb/templates/new" element={<FitdbTemplateBuilder />} />
          <Route path="fitdb/templates/:id" element={<FitdbTemplateBuilder />} />
          <Route path="fitdb/clients" element={<FitdbClients />} />
          <Route path="fitdb/clients/:id" element={<FitdbClientDetail />} />
          <Route path="fitdb/history" element={<FitdbWorkoutHistory />} />
          {/* MiniApp demo - для тестирования Telegram Mini App */}
          <Route path="miniapp" element={<MiniAppDemo />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
