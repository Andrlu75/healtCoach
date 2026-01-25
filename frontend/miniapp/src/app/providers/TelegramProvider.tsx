import { useEffect, type ReactNode } from 'react'
import WebApp from '@twa-dev/sdk'

interface TelegramProviderProps {
  children: ReactNode
}

export function TelegramProvider({ children }: TelegramProviderProps) {
  useEffect(() => {
    WebApp.ready()
    WebApp.expand()
    WebApp.enableClosingConfirmation()
  }, [])

  return <>{children}</>
}
