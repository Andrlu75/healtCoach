import api from './client'
import type {
  BotPersona,
  AIModelSelection,
  AIProviderConfig,
  AIModelConfigEntry,
  AIModelInfo,
  AIUsageResponse,
  TelegramSettings,
  DashboardStats,
  ProviderType,
} from '../types'

export const settingsApi = {
  getPersona: () => api.get<BotPersona>('/persona/'),
  updatePersona: (data: Partial<BotPersona>) => api.put<BotPersona>('/persona/', data),

  // AI Model Selection
  getAISettings: () => api.get<AIModelSelection>('/persona/ai/'),
  updateAISettings: (data: Partial<AIModelSelection>) => api.put('/persona/ai/', data),

  // AI Providers
  getProviders: () => api.get<AIProviderConfig[]>('/persona/providers/'),
  addProvider: (provider: ProviderType, api_key: string) =>
    api.post<{ provider: AIProviderConfig; models: AIModelInfo[] }>('/persona/providers/', { provider, api_key }),
  deleteProvider: (id: number) => api.delete(`/persona/providers/${id}/`),
  fetchModels: (provider: ProviderType, api_key?: string) =>
    api.post<{ models: AIModelInfo[] }>('/persona/providers/models/', { provider, api_key: api_key || '' }),

  // AI Models (added by coach)
  getModels: () => api.get<AIModelConfigEntry[]>('/persona/models/'),
  addModels: (models: { provider: ProviderType; model_id: string; model_name: string }[]) =>
    api.post<AIModelConfigEntry[]>('/persona/models/', { models }),
  deleteModel: (id: number) => api.delete(`/persona/models/${id}/`),

  // AI Test
  testChat: (messages: { role: string; content: string }[]) =>
    api.post<{ response: string; model: string; usage: Record<string, number> }>(
      '/persona/ai/test/',
      { task_type: 'text', messages }
    ),
  testVision: (image: File) => {
    const formData = new FormData()
    formData.append('task_type', 'vision')
    formData.append('image', image)
    return api.post<{ response: string; model: string; usage: Record<string, number> }>(
      '/persona/ai/test/',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },

  // AI Usage Stats
  getUsageStats: (period?: string, provider?: string, model?: string) => {
    const params = new URLSearchParams()
    if (period) params.append('period', period)
    if (provider) params.append('provider', provider)
    if (model) params.append('model', model)
    const query = params.toString()
    return api.get<AIUsageResponse>(`/persona/ai/usage/${query ? '?' + query : ''}`)
  },

  // Telegram
  getTelegramSettings: () => api.get<TelegramSettings>('/persona/telegram/'),
  updateTelegramSettings: (data: TelegramSettings) => api.put('/persona/telegram/', data),
  testTelegram: (bot_token: string, chat_id: string) =>
    api.post('/persona/telegram/test/', { bot_token, chat_id }),

  getDashboardStats: () => api.get<DashboardStats>('/persona/dashboard/'),
}
