export * from './dishes'
export * from './nutrition'

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
  gender: 'male' | 'female' | null
  age: number | null
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null
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
  role: 'main' | 'controller'
  controller: number | null
  controller_name: string | null
  age: number | null
  city: string
  style_description: string
  system_prompt: string
  food_response_prompt: string
  nutrition_program_prompt: string
  shopping_list_prompt: string
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
  has_admin_key: boolean
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
  image: string | null
  dish_name: string
  dish_type: string
  image_type: string
  calories: number | null
  proteins: number | null
  fats: number | null
  carbohydrates: number | null
  ingredients: string[]
  health_analysis: Record<string, unknown>
  ai_confidence: number | null
  plate_type: string
  layout: string
  decorations: string
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
  image_url: string | null
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

// Упражнения
export interface ExerciseCategory {
  id: number
  name: string
  description: string
  color: string
  icon: string
  order: number
  is_active: boolean
  exercises_count: number
  created_at: string
}

export interface ExerciseType {
  id: number
  name: string
  description: string
  parameters: string[]
  parameters_display: { key: string; label: string }[]
  is_active: boolean
  created_at: string
}

export interface Exercise {
  id: number
  name: string
  description: string
  instructions: string[]
  category: number | null
  category_name: string | null
  exercise_type: number | null
  type_name: string | null
  type_parameters: { key: string; label: string }[]
  image: string | null
  video_url: string
  media_type: 'image' | 'video'
  default_parameters: Record<string, number>
  muscle_groups: string[]
  equipment: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  is_active: boolean
  created_at: string
  updated_at: string
}

// Тренировки
export interface WorkoutTemplate {
  id: number
  name: string
  description: string
  estimated_duration: number | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  is_active: boolean
  blocks_count: number
  exercises_count: number
  created_at: string
  updated_at: string
  blocks?: WorkoutTemplateBlock[]
}

export interface WorkoutTemplateBlock {
  id: number
  name: string
  block_type: 'warmup' | 'main' | 'cooldown' | 'custom'
  order: number
  rounds: number
  rest_between_rounds: number
  exercises: WorkoutTemplateExercise[]
}

export interface WorkoutTemplateExercise {
  id: number
  exercise: number
  exercise_detail: Exercise
  order: number
  parameters: Record<string, number>
  rest_after: number
  superset_group: number | null
  notes: string
}

export interface ClientWorkout {
  id: number
  client: number
  client_name: string
  template: number | null
  template_name: string | null
  name: string
  description: string
  scheduled_date: string | null
  scheduled_time: string | null
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'skipped'
  estimated_duration: number | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  notes: string
  reminder_enabled: boolean
  reminder_minutes_before: number
  blocks_count: number
  exercises_count: number
  last_session: {
    id: number
    status: string
    started_at: string
    completion_percentage: number
  } | null
  created_at: string
  updated_at: string
  blocks?: WorkoutBlock[]
}

export interface WorkoutBlock {
  id: number
  name: string
  block_type: 'warmup' | 'main' | 'cooldown' | 'custom'
  order: number
  rounds: number
  rest_between_rounds: number
  exercises: WorkoutExercise[]
  supersets: WorkoutSuperset[]
}

export interface WorkoutSuperset {
  id: number
  name: string
  order: number
  rounds: number
  rest_after: number
  exercises: WorkoutExercise[]
}

export interface WorkoutExercise {
  id: number
  exercise: number
  exercise_detail: Exercise
  superset: number | null
  order: number
  parameters: Record<string, number>
  rest_after: number
  notes: string
}

export interface WorkoutSession {
  id: number
  workout: number
  workout_name: string
  started_at: string
  finished_at: string | null
  status: 'in_progress' | 'completed' | 'paused' | 'abandoned'
  duration_seconds: number | null
  total_exercises: number
  completed_exercises: number
  total_sets: number
  completed_sets: number
  completion_percentage: number
  calories_burned: number | null
  client_notes: string
  client_rating: number | null
  fatigue_level: number | null
}

export interface TrainingSchedule {
  id: number
  client: number
  client_name: string
  name: string
  days_of_week: number[]
  days_display: string[]
  time: string
  template: number | null
  template_name: string | null
  is_active: boolean
  start_date: string
  end_date: string | null
  created_at: string
}

export interface TrainingProgram {
  id: number
  client: number
  client_name: string
  name: string
  description: string
  duration_weeks: number
  status: 'draft' | 'active' | 'completed' | 'paused'
  start_date: string | null
  current_week: number
  workouts_count: number
  progress_percentage: number
  created_at: string
  updated_at: string
}
