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
  text_provider: string
  text_model: string
  vision_provider: string
  vision_model: string
  voice_provider: string
  voice_model: string
  temperature: number
  max_tokens: number
  created_at: string
  updated_at: string
}

export type ProviderType = 'openai' | 'deepseek'

export interface AIProviderConfig {
  id: number
  provider: ProviderType
  is_active: boolean
  masked_key: string
  created_at: string
}

export interface AIModelConfigEntry {
  id: number
  provider: ProviderType
  model_id: string
  model_name: string
  created_at: string
  price_input: number | null
  price_output: number | null
  supports_text: boolean
  supports_vision: boolean
  supports_audio: boolean
  context_length: number | null
}

export interface AIModelSelection {
  text_provider: string
  text_model: string
  vision_provider: string
  vision_model: string
  voice_provider: string
  voice_model: string
  temperature: number
  max_tokens: number
}

export interface AIModelInfo {
  id: string
  name: string
  price_input: number | null
  price_output: number | null
  supports_text: boolean
  supports_vision: boolean
  supports_audio: boolean
  context_length: number | null
}

export interface AIUsageStats {
  provider: string
  model: string
  task_type: string
  requests_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
}

export interface AIUsageResponse {
  stats: AIUsageStats[]
  total_cost_usd: number
  period: string
}

export interface TelegramBot {
  id: number
  name: string
  masked_token: string
  is_active: boolean
  created_at: string
}

export interface TelegramSettings {
  bots: TelegramBot[]
  notification_chat_id: string
}

export interface DashboardStats {
  total_clients: number
  active_clients: number
  pending_clients: number
  paused_clients: number
}
