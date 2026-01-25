import { create } from 'zustand'
import WebApp from '@twa-dev/sdk'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  syncWithTelegram: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (WebApp.colorScheme as Theme) || 'light',

  setTheme: (theme) => {
    set({ theme })
    document.documentElement.classList.toggle('dark', theme === 'dark')
  },

  syncWithTelegram: () => {
    const theme = (WebApp.colorScheme as Theme) || 'light'
    set({ theme })
    document.documentElement.classList.toggle('dark', theme === 'dark')
  },
}))
