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
  height: number | null
  weight: number | null
  birth_date: string | null
  daily_calories: number | null
  daily_proteins: number | null
  daily_fats: number | null
  daily_carbs: number | null
  daily_water: number | null
  manual_mode: boolean
  onboarding_completed: boolean
  onboarding_data: Record<string, unknown>
  persona: number | null
  persona_name: string | null
  created_at: string
  updated_at: string
  meals_count?: number
  last_activity?: string | null
}

export interface BotPersona {
  id: number
  name: string
  is_default: boolean
  age: number | null
  city: string
  style_description: string
  system_prompt: string
  food_response_prompt: string
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

export type ProviderType = 'openai' | 'deepseek' | 'anthropic'

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

export interface AIClientUsageStats {
  client_id: number | null
  client_name: string
  requests_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
}

export interface AIUsageResponse {
  stats: AIUsageStats[]
  stats_by_client: AIClientUsageStats[]
  total_cost_usd: number
  period: string
}

export interface TelegramBot {
  id: number
  name: string
  username: string
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

export interface Meal {
  id: number
  dish_name: string
  dish_type: string
  image_type: string
  calories: number | null
  proteins: number | null
  fats: number | null
  carbohydrates: number | null
  meal_time: string
  created_at: string
}

export interface HealthMetric {
  id: number
  client: number
  metric_type: string
  value: number
  unit: string
  source: string
  recorded_at: string
  created_at: string
}

export interface ChatMessage {
  id: number
  client: number
  role: 'user' | 'assistant' | 'system'
  message_type: string
  content: string
  created_at: string
}

export interface Report {
  id: number
  client: number
  client_name: string
  report_type: 'daily' | 'weekly'
  period_start: string
  period_end: string
  content: Record<string, unknown> | null
  summary: string
  pdf_url: string | null
  is_sent: boolean
  created_at: string
}

export interface InviteLink {
  id: number
  code: string
  max_uses: number
  uses_count: number
  is_active: boolean
  expires_at: string | null
  invite_url: string
  created_at: string
}

export interface InteractionLog {
  id: number
  client: number
  client_name: string
  interaction_type: 'text' | 'vision' | 'voice'
  client_input: string
  ai_request: Record<string, unknown>
  ai_response: Record<string, unknown>
  client_output: string
  provider: string
  model: string
  duration_ms: number
  created_at: string
}

export interface OnboardingQuestion {
  id: number
  text: string
  question_type: 'text' | 'number' | 'choice' | 'multi_choice' | 'date'
  options: string[]
  is_required: boolean
  order: number
  field_key: string
  created_at: string
}
