import { create } from 'zustand'
import { telegramAuth } from '../../api/endpoints'
import type { ClientData, UserRole } from '../../types'

interface AuthState {
  client: ClientData | null
  role: UserRole
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  authenticate: (initData: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  client: null,
  role: 'client',
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,

  authenticate: async (initData: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await telegramAuth(initData)
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      set({
        client: data.client,
        role: data.role || 'client',
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка авторизации'
      set({ error: message, isLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ client: null, isAuthenticated: false })
  },
}))
