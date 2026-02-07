import api from './client'
import type { Meal, HealthMetric, ChatMessage, Report, InviteLink, OnboardingQuestion, InteractionLog, Reminder, ContextBlock } from '../types'

export interface MealDashboardItem {
  id: number
  dish_name: string
  dish_type: string
  calories: number
  proteins: number
  fats: number
  carbs: number
  meal_time: string
  thumbnail: string | null
  image: string | null
  ai_comment: string
  ingredients: string[]
}

export interface ClientMealsDashboard {
  client_id: number
  client_name: string
  meals: MealDashboardItem[]
  totals: { calories: number; proteins: number; fats: number; carbs: number }
  norms: { calories: number; proteins: number; fats: number; carbs: number }
}

export interface MealsDashboardResponse {
  date: string
  clients: ClientMealsDashboard[]
}

export const mealsApi = {
  list: (params?: { client_id?: number; date?: string }) =>
    api.get<Meal[]>('/meals/', { params }),
  dashboard: () =>
    api.get<MealsDashboardResponse>('/meals/dashboard/'),
}

// Workouts Dashboard
export interface WorkoutDashboardItem {
  id: number
  name: string
  scheduled_time: string | null
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'skipped'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimated_duration: number | null
  exercises_count: number
  session: {
    id: number
    status: string
    completion_percentage: number
    duration_seconds: number | null
  } | null
}

export interface ClientWorkoutsDashboard {
  client_id: number
  client_name: string
  workouts: WorkoutDashboardItem[]
  summary: {
    total: number
    completed: number
    in_progress: number
    pending: number
  }
}

export interface WorkoutsDashboardResponse {
  date: string
  clients: ClientWorkoutsDashboard[]
}

export interface WorkoutExerciseReport {
  exercise_id: number
  exercise_name: string
  muscle_group: string
  planned_sets: number
  planned_reps: number | null
  planned_weight: number | null
  planned_duration_seconds: number | null
  is_completed: boolean
  actual_sets: {
    set_number: number
    reps: number
    weight_kg: number | null
    duration_seconds: number | null
    completed_at: string | null
  }[]
}

export interface WorkoutSessionReport {
  session: {
    id: number
    started_at: string
    completed_at: string | null
    duration_seconds: number | null
    status: 'completed' | 'in_progress'
  } | null
  workout_name: string
  planned_exercises: WorkoutExerciseReport[]
  totals: {
    planned_exercises: number
    completed_exercises: number
    total_sets: number
    completed_sets: number
    volume_kg: number
  }
}

export const workoutsApi = {
  dashboard: () =>
    api.get<WorkoutsDashboardResponse>('/workouts/dashboard/'),
  assignmentReport: (assignmentId: number) =>
    api.get<WorkoutSessionReport>(`/workouts/assignments/${assignmentId}/detail_report/`),
}

export const metricsApi = {
  list: (params?: { client_id?: number; type?: string; date_from?: string; date_to?: string }) =>
    api.get<HealthMetric[]>('/metrics/', { params }),
}

export interface UnreadMessagesResponse {
  by_client: Record<number, number>
  total: number
}

export const chatApi = {
  messages: (client_id: number) =>
    api.get<{ results: ChatMessage[] }>('/chat/messages/', { params: { client_id } }),
  send: (client_id: number, text: string) =>
    api.post<ChatMessage>('/chat/send/', { client_id, text }),
  unread: () =>
    api.get<UnreadMessagesResponse>('/chat/unread/'),
}

export const reportsApi = {
  list: (params?: { client_id?: number; type?: string }) =>
    api.get<Report[]>('/reports/', { params }),
  get: (id: number) =>
    api.get<Report>(`/reports/${id}/`),
  generate: (client_id: number, type: string, date?: string) =>
    api.post<Report>('/reports/generate/', { client_id, type, date }),
}

export const logsApi = {
  list: (params?: { client_id?: number; interaction_type?: string; date_from?: string; date_to?: string; page?: number; page_size?: number }) =>
    api.get<{ results: InteractionLog[]; count: number; page: number; page_size: number }>('/chat/logs/', { params }),
}

// Integrations
export interface IntegrationStatus {
  type: string
  name: string
  connected: boolean
  last_sync_at?: string
  has_error?: boolean
  error_message?: string
  error_count?: number
  last_sync_status?: string
  metrics_synced?: Record<string, number>
}

export interface ClientIntegrations {
  client_id: number
  client_name: string
  integrations: IntegrationStatus[]
}

export interface IntegrationsOverviewResponse {
  clients: ClientIntegrations[]
  summary: {
    google_fit_active: number
    huawei_health_active: number
    total_clients: number
  }
}

export const integrationsApi = {
  overview: () =>
    api.get<IntegrationsOverviewResponse>('/integrations/overview/'),
  triggerSync: (client_id: number, integration_type: string) =>
    api.post('/integrations/sync/', { client_id, integration_type }),
  disconnect: (client_id: number, integration_type: string) =>
    api.post('/integrations/disconnect/', { client_id, integration_type }),
  logs: (client_id: number, integration_type: string) =>
    api.get<{ logs: Array<{ id: number; started_at: string; finished_at: string | null; status: string; metrics_synced: Record<string, number>; error_message: string }> }>('/integrations/logs/', { params: { client_id, integration_type } }),
}

export const clientMemoryApi = {
  add: (clientId: number, content: string) =>
    api.post<{ memory: string[] }>(`/clients/${clientId}/memory/add/`, { content }),
  remove: (clientId: number, index: number) =>
    api.post<{ memory: string[] }>(`/clients/${clientId}/memory/delete/`, { index }),
}

export const remindersApi = {
  list: (clientId: number) =>
    api.get<Reminder[]>('/reminders/', { params: { client_id: clientId } }),
  create: (data: Record<string, unknown>) =>
    api.post<Reminder>('/reminders/', data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put<Reminder>(`/reminders/${id}/`, data),
  delete: (id: number) =>
    api.delete(`/reminders/${id}/`),
  test: (id: number) =>
    api.post<{ status: string }>(`/reminders/${id}/test/`),
  generateText: (data: { client_id: number; reminder_type: string; context_blocks?: string[]; base_text?: string; generation_prompt?: string }) =>
    api.post<{ text: string }>('/reminders/generate-text/', data),
  contextBlocks: () =>
    api.get<ContextBlock[]>('/reminders/context-blocks/'),
}

export const onboardingApi = {
  getQuestions: () =>
    api.get<OnboardingQuestion[]>('/onboarding/questions/'),
  createQuestion: (data: Partial<OnboardingQuestion>) =>
    api.post<OnboardingQuestion>('/onboarding/questions/', data),
  updateQuestion: (id: number, data: Partial<OnboardingQuestion>) =>
    api.put<OnboardingQuestion>(`/onboarding/questions/${id}/`, data),
  deleteQuestion: (id: number) =>
    api.delete(`/onboarding/questions/${id}/`),

  getInvites: () =>
    api.get<InviteLink[]>('/onboarding/invites/'),
  createInvite: (data: { max_uses?: number }) =>
    api.post<InviteLink>('/onboarding/invites/', data),
  deleteInvite: (id: number) =>
    api.delete(`/onboarding/invites/${id}/`),
}
