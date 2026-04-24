import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 минуты для долгих AI запросов
  headers: {
    'Content-Type': 'application/json',
  },
})

// Механизм для предотвращения race condition при refresh токена
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token))
  refreshSubscribers = []
}

// Эндпоинты, на которые нельзя передавать access_token — иначе протухший
// токен приводит к 401 от JWT middleware ещё до выполнения вьюхи, хотя
// сами эндпоинты разрешены AllowAny.
const AUTH_ENDPOINTS = ['/auth/telegram/', '/auth/refresh/']

api.interceptors.request.use((config) => {
  const url = config.url || ''
  const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => url.includes(path))
  if (isAuthEndpoint) {
    if (config.headers) {
      delete config.headers.Authorization
    }
    return config
  }
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Если уже идёт refresh, ждём его завершения
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh/`, {
            refresh: refreshToken,
          }, { timeout: 10000 })
          localStorage.setItem('access_token', data.access)
          onTokenRefreshed(data.access)
          originalRequest.headers.Authorization = `Bearer ${data.access}`
          return api(originalRequest)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        } finally {
          isRefreshing = false
        }
      } else {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
