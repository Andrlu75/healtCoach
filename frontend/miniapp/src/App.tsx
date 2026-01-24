import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WebApp from '@twa-dev/sdk'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru')

import { useAuthStore } from './stores/auth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Diary from './pages/Diary'
import Stats from './pages/Stats'
import Reminders from './pages/Reminders'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AppContent() {
  const { isAuthenticated, isLoading, error, authenticate } = useAuthStore()

  useEffect(() => {
    WebApp.ready()
    WebApp.expand()

    if (!isAuthenticated) {
      const initData = WebApp.initData
      if (initData) {
        authenticate(initData)
      }
    }
  }, [isAuthenticated, authenticate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || (!isAuthenticated && !isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <p className="text-gray-500 text-center">
          {error || 'Откройте приложение через Telegram'}
        </p>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/diary" element={<Diary />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/reminders" element={<Reminders />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
