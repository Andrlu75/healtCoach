import { useEffect, type ReactNode } from 'react'
import WebApp from '@twa-dev/sdk'
import { useThemeStore } from '../../shared/stores/theme'

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { syncWithTelegram } = useThemeStore()

  useEffect(() => {
    syncWithTelegram()

    const handleThemeChange = () => {
      syncWithTelegram()
    }

    WebApp.onEvent('themeChanged', handleThemeChange)

    return () => {
      WebApp.offEvent('themeChanged', handleThemeChange)
    }
  }, [syncWithTelegram])

  useEffect(() => {
    const root = document.documentElement
    const themeParams = WebApp.themeParams

    if (themeParams) {
      root.style.setProperty('--tg-bg-color', themeParams.bg_color || '#ffffff')
      root.style.setProperty('--tg-secondary-bg-color', themeParams.secondary_bg_color || '#f4f4f5')
      root.style.setProperty('--tg-text-color', themeParams.text_color || '#000000')
      root.style.setProperty('--tg-hint-color', themeParams.hint_color || '#999999')
      root.style.setProperty('--tg-link-color', themeParams.link_color || '#2481cc')
      root.style.setProperty('--tg-button-color', themeParams.button_color || '#2481cc')
      root.style.setProperty('--tg-button-text-color', themeParams.button_text_color || '#ffffff')
    }
  }, [])

  return <>{children}</>
}
