import { useEffect, type ReactNode } from 'react'
import WebApp from '@twa-dev/sdk'
import { useAuthStore } from './store'
import { PageSpinner } from '../../shared/components/ui/Spinner'
import { Onboarding } from '../onboarding/Onboarding'

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { status, isLoading, error, needsOnboarding, authenticate } = useAuthStore()

  useEffect(() => {
    if (status === 'idle' && !isLoading) {
      const initData = WebApp.initData
      if (initData) {
        authenticate(initData)
      }
    }
  }, [status, isLoading, authenticate])

  if (isLoading || status === 'loading') {
    return <PageSpinner />
  }

  // New user without invite link
  if (status === 'need_invite') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="text-6xl mb-6">🔗</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Нужна ссылка от коуча
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
          Для регистрации попросите вашего коуча отправить вам персональную ссылку-приглашение
        </p>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl max-w-xs">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            После получения ссылки просто нажмите на неё — приложение откроется автоматически
          </p>
        </div>
      </div>
    )
  }

  // Invalid or expired invite
  if (status === 'invalid_invite') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Ссылка недействительна
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
          Эта ссылка-приглашение истекла или уже была использована
        </p>
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl max-w-xs">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Попросите коуча отправить новую ссылку
          </p>
        </div>
      </div>
    )
  }

  // General error
  if (status === 'error' || error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="text-6xl mb-6">😕</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Ошибка
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-xs">
          {error || 'Что-то пошло не так'}
        </p>
      </div>
    )
  }

  // Not opened via Telegram
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="text-6xl mb-6">📱</div>
        <p className="text-gray-500 dark:text-gray-400">
          Откройте приложение через Telegram
        </p>
      </div>
    )
  }

  // Authenticated but needs onboarding
  if (needsOnboarding) {
    return <Onboarding />
  }

  // Fully authenticated and onboarded
  return <>{children}</>
}
