import api from './client'

// Auth
export const telegramAuth = (initData: string) =>
  api.post('/auth/telegram/', { initData })

// Meals (client-facing)
export const getMeals = (params?: { date?: string }) =>
  api.get('/miniapp/meals/', { params })

export const getDailySummary = (params?: { date?: string }) =>
  api.get('/miniapp/meals/daily/', { params })

// Reminders (client-facing)
export const getReminders = () =>
  api.get('/miniapp/reminders/')

export const toggleReminder = (id: number, is_active: boolean) =>
  api.patch('/miniapp/reminders/', { id, is_active })
