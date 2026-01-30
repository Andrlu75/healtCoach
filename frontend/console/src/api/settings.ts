import api from './client'
import type {
  BotPersona,
  AIModelSelection,
  AIProviderConfig,
  AIModelConfigEntry,
  AIModelInfo,
  AIUsageResponse,
  TelegramSettings,
  TelegramBot,
  DashboardStats,
  ProviderType,
} from '../types'

export const settingsApi = {
  getPersonas: () => api.get<BotPersona[]>('/persona/'),
  createPersona: (data: Partial<BotPersona>) => api.post<BotPersona>('/persona/', data),
  updatePersona: (data: Partial<BotPersona> & { id: number }) => api.put<BotPersona>('/persona/', data),
  deletePersona: (id: number) => api.delete(`/persona/?id=${id}`),
  setPersonaDefault: (id: number) => api.post(`/persona/${id}/set_default/`),

  // AI Model Selection
  getAISettings: () => api.get<AIModelSelection>('/persona/ai/'),
  updateAISettings: (data: Partial<AIModelSelection>) => api.put('/persona/ai/', data),

  // AI Providers
  getProviders: () => api.get<AIProviderConfig[]>('/persona/providers/'),
  addProvider: (provider: ProviderType, api_key: string) =>
    api.post<{ provider: AIProviderConfig; models: AIModelInfo[] }>('/persona/providers/', { provider, api_key }),
  deleteProvider: (id: number) => api.delete(`/persona/providers/${id}/`),
  updateProviderAdminKey: (id: number, admin_api_key: string) =>
    api.put<{ status: string; has_admin_key: boolean }>(`/persona/providers/${id}/admin-key/`, { admin_api_key }),
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

  // OpenAI Usage API (real costs from OpenAI)
  getOpenAIUsage: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const query = params.toString()
    return api.get<{
      usage: { data?: Array<{ date: string; input_tokens: number; output_tokens: number }> };
      costs: { data?: Array<{ date: string; amount_cents: number }> };
      start_date: string;
      end_date: string;
    }>(`/persona/ai/usage/openai/${query ? '?' + query : ''}`)
  },

  // Telegram
  getTelegramSettings: () => api.get<TelegramSettings>('/persona/telegram/'),
  addTelegramBot: (name: string, token: string) =>
    api.post<TelegramBot>('/persona/telegram/', { name, token }),
  switchTelegramBot: (bot_id: number) =>
    api.put<{ status: string; webhook_error?: string }>('/persona/telegram/', { bot_id }),
  updateNotificationChatId: (notification_chat_id: string) =>
    api.put('/persona/telegram/', { notification_chat_id }),
  deleteTelegramBot: (bot_id: number) =>
    api.delete(`/persona/telegram/?bot_id=${bot_id}`),
  testTelegram: (chat_id: string, bot_token?: string) => {
    if (!chat_id?.trim()) {
      return Promise.reject(new Error('Chat ID не указан'))
    }
    return api.post('/persona/telegram/test/', { bot_token: bot_token || '', chat_id: chat_id.trim() })
  },

  getDashboardStats: () => api.get<DashboardStats>('/persona/dashboard/'),
}
