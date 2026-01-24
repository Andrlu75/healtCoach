import api from './client'
import type { BotPersona, AISettings, TelegramSettings, DashboardStats } from '../types'

export const settingsApi = {
  getPersona: () => api.get<BotPersona>('/persona/'),
  updatePersona: (data: Partial<BotPersona>) => api.put<BotPersona>('/persona/', data),

  getAISettings: () => api.get<AISettings>('/persona/ai/'),
  updateAISettings: (data: AISettings) => api.put('/persona/ai/', data),

  getTelegramSettings: () => api.get<TelegramSettings>('/persona/telegram/'),
  updateTelegramSettings: (data: TelegramSettings) => api.put('/persona/telegram/', data),

  getDashboardStats: () => api.get<DashboardStats>('/persona/dashboard/'),
}
