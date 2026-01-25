import { useEffect, type ReactNode } from 'react'
import WebApp from '@twa-dev/sdk'
import { useAuthStore } from './store'
import { PageSpinner } from '../../shared/components/ui/Spinner'

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading, error, authenticate } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      const initData = WebApp.initData
      if (initData) {
        authenticate(initData)
      }
    }
  }, [isAuthenticated, isLoading, authenticate])

  if (isLoading) {
    return <PageSpinner />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-4xl mb-4">:(</div>
        <p className="text-gray-500 dark:text-gray-400 text-center">
          {error}
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Откройте приложение через Telegram
        </p>
      </div>
    )
  }

  return <>{children}</>
}
