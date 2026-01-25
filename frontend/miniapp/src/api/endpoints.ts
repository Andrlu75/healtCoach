import api from './client'

// Auth
export const telegramAuth = (initData: string) =>
  api.post('/auth/telegram/', { initData })

// Meals (client-facing)
export const getMeals = (params?: { date?: string }) =>
  api.get('/miniapp/meals/', { params })

export const getDailySummary = (params?: { date?: string }) =>
  api.get('/miniapp/meals/daily/', { params })

export const addMeal = (data: {
  dish_name: string
  dish_type: string
  calories?: number
  proteins?: number
  fats?: number
  carbohydrates?: number
}) => api.post('/miniapp/meals/', data)

export const addMealWithPhoto = (formData: FormData) =>
  api.post('/miniapp/meals/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

export const analyzeMealPhoto = (formData: FormData) =>
  api.post<{
    dish_name: string
    dish_type: string
    calories: number
    proteins: number
    fats: number
    carbohydrates: number
    ingredients?: string[]
    confidence?: number
  }>('/miniapp/meals/analyze/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

export const deleteMeal = (id: number) =>
  api.delete(`/miniapp/meals/${id}/`)

// Metrics
export const getMetrics = (params?: { metric_type?: string }) =>
  api.get('/miniapp/metrics/', { params })

export const addMetric = (data: { metric_type: string; value: number }) =>
  api.post('/miniapp/metrics/', data)

export const addWater = (amount: number) =>
  api.post('/miniapp/metrics/water/', { amount })

// Profile
export const getProfile = () =>
  api.get('/miniapp/profile/')

export const updateProfile = (data: Partial<{
  daily_calories: number
  daily_proteins: number
  daily_fats: number
  daily_carbs: number
  daily_water: number
}>) => api.patch('/miniapp/profile/', data)

// Reminders (client-facing)
export const getReminders = () =>
  api.get('/miniapp/reminders/')

export const toggleReminder = (id: number, is_active: boolean) =>
  api.patch('/miniapp/reminders/', { id, is_active })
