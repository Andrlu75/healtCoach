import api from './client'
import type { Meal, HealthMetric, ChatMessage, Report, InviteLink, OnboardingQuestion } from '../types'

export const mealsApi = {
  list: (params?: { client_id?: number; date?: string }) =>
    api.get<Meal[]>('/meals/', { params }),
}

export const metricsApi = {
  list: (params?: { client_id?: number; type?: string; date_from?: string; date_to?: string }) =>
    api.get<HealthMetric[]>('/metrics/', { params }),
}

export const chatApi = {
  messages: (client_id: number) =>
    api.get<{ results: ChatMessage[] }>('/chat/messages/', { params: { client_id } }),
}

export const reportsApi = {
  list: (params?: { client_id?: number; type?: string }) =>
    api.get<Report[]>('/reports/', { params }),
  get: (id: number) =>
    api.get<Report>(`/reports/${id}/`),
  generate: (client_id: number, type: string, date?: string) =>
    api.post<Report>('/reports/generate/', { client_id, type, date }),
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
