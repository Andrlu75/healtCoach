import { create } from 'zustand'
import api from '../api/client'
import type { User, Coach } from '../types'

interface AuthState {
  user: User | null
  coach: Coach | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  loadProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  coach: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,

  login: async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    set({ isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, coach: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  loadProfile: async () => {
    set({ isLoading: true })
    try {
      const { data } = await api.get('/coach/profile/')

      set({ user: data.user, coach: data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },
}))
