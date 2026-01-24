export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'coach' | 'client'
}

export interface Coach {
  id: number
  user: User
  telegram_user_id: number | null
  business_name: string
  timezone: string
  created_at: string
}

export interface Client {
  id: number
  telegram_user_id: number
  telegram_username: string
  first_name: string
  last_name: string
  full_name: string
  city: string
  timezone: string
  status: 'pending' | 'active' | 'paused' | 'archived'
  daily_calories: number | null
  daily_proteins: number | null
  daily_fats: number | null
  daily_carbs: number | null
  daily_water: number | null
  onboarding_completed: boolean
  onboarding_data: Record<string, unknown>
  created_at: string
  updated_at: string
  meals_count?: number
  last_activity?: string | null
}

export interface BotPersona {
  id: number
  name: string
  age: number | null
  city: string
  style_description: string
  system_prompt: string
  greeting_message: string
  ai_provider: 'openai' | 'anthropic'
  ai_model_chat: string
  ai_model_vision: string
  temperature: number
  max_tokens: number
  created_at: string
  updated_at: string
}

export interface AISettings {
  ai_provider: 'openai' | 'anthropic'
  ai_model_chat: string
  ai_model_vision: string
  temperature: number
  max_tokens: number
  openai_api_key: string
  anthropic_api_key: string
}

export interface TelegramSettings {
  bot_token: string
  webhook_url: string
  notification_chat_id: string
}

export interface DashboardStats {
  total_clients: number
  active_clients: number
  pending_clients: number
  paused_clients: number
}
