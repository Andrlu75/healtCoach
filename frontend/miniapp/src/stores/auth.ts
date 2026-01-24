import { create } from 'zustand'
import { telegramAuth } from '../api/endpoints'

interface ClientData {
  id: number
  first_name: string
  last_name: string
  daily_calories: number | null
  daily_proteins: number | null
  daily_fats: number | null
  daily_carbs: number | null
  daily_water: number | null
  onboarding_completed: boolean
}

interface AuthState {
  client: ClientData | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  authenticate: (initData: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  client: null,
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
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      set({ error: message, isLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ client: null, isAuthenticated: false })
  },
}))
