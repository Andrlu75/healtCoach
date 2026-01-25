import { create } from 'zustand'
import { telegramAuth } from '../../api/endpoints'
import type { ClientData, UserRole } from '../../types'

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'need_invite' | 'invalid_invite' | 'error'

interface AuthState {
  client: ClientData | null
  role: UserRole
  status: AuthStatus
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  needsOnboarding: boolean
  authenticate: (initData: string) => Promise<void>
  setClient: (client: ClientData) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  client: null,
  role: 'client',
  status: localStorage.getItem('access_token') ? 'authenticated' : 'idle',
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,
  needsOnboarding: false,

  authenticate: async (initData: string) => {
    set({ isLoading: true, status: 'loading', error: null })
    try {
      const { data } = await telegramAuth(initData)

      // Check for special statuses (new user without invite, invalid invite)
      if (data.status === 'need_invite') {
        set({
          status: 'need_invite',
          isLoading: false,
          error: data.message || 'Для регистрации необходима ссылка от коуча',
        })
        return
      }

      if (data.status === 'invalid_invite') {
        set({
          status: 'invalid_invite',
          isLoading: false,
          error: data.message || 'Ссылка недействительна или истекла',
        })
        return
      }

      // Success - save tokens
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)

      const needsOnboarding = !data.client.onboarding_completed

      set({
        client: data.client,
        role: data.role || 'client',
        status: 'authenticated',
        isAuthenticated: true,
        isLoading: false,
        needsOnboarding,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка авторизации'
      set({ error: message, status: 'error', isLoading: false })
    }
  },

  setClient: (client: ClientData) => {
    set({
      client,
      needsOnboarding: !client.onboarding_completed,
    })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ client: null, isAuthenticated: false, status: 'idle', needsOnboarding: false })
  },
}))
