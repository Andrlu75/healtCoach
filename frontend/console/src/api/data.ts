import api from './client'
import type { Meal, HealthMetric, ChatMessage, Report, InviteLink, OnboardingQuestion, InteractionLog } from '../types'

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

export const workoutsApi = {
  dashboard: () =>
    api.get<WorkoutsDashboardResponse>('/workouts/dashboard/'),
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
