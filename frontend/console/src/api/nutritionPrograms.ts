import api from './client'
import type {
  ComplianceStats,
  MealComplianceCheck,
  NutritionProgram,
  NutritionProgramCreatePayload,
  NutritionProgramDay,
  NutritionProgramListItem,
  NutritionProgramUpdatePayload,
} from '../types/nutrition'

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const nutritionProgramsApi = {
  // Programs CRUD
  list: (params?: { client?: number; status?: string; search?: string }) =>
    api.get<PaginatedResponse<NutritionProgramListItem>>('/nutrition/programs/', { params }),

  get: (id: number) => api.get<NutritionProgram>(`/nutrition/programs/${id}/`),

  create: (data: NutritionProgramCreatePayload) =>
    api.post<NutritionProgram>('/nutrition/programs/', data),

  update: (id: number, data: NutritionProgramUpdatePayload) =>
    api.patch<NutritionProgram>(`/nutrition/programs/${id}/`, data),

  delete: (id: number) => api.delete(`/nutrition/programs/${id}/`),

  // Actions
  activate: (id: number) => api.post(`/nutrition/programs/${id}/activate/`),
  cancel: (id: number) => api.post(`/nutrition/programs/${id}/cancel/`),
  complete: (id: number) => api.post(`/nutrition/programs/${id}/complete/`),
  copy: (id: number, data: { client?: number; start_date: string; name?: string }) =>
    api.post<NutritionProgram>(`/nutrition/programs/${id}/copy/`, data),

  // Days
  getDays: (programId: number) =>
    api.get<NutritionProgramDay[]>(`/nutrition/programs/${programId}/days/`),

  updateDay: (programId: number, dayId: number, data: Partial<NutritionProgramDay>) =>
    api.patch<NutritionProgramDay>(`/nutrition/programs/${programId}/days/${dayId}/`, data),

  copyDay: (programId: number, dayId: number, sourceDayId: number) =>
    api.post<NutritionProgramDay>(`/nutrition/programs/${programId}/days/${dayId}/copy/`, {
      source_day_id: sourceDayId,
    }),

  // Stats
  getStats: (params?: { program_id?: number; client_id?: number }) =>
    api.get<ComplianceStats[]>('/nutrition/stats/', { params }),

  getViolations: (params?: {
    program_id?: number
    client_id?: number
    notified?: boolean
  }) => api.get<MealComplianceCheck[]>('/nutrition/stats/violations/', { params }),

  markNotified: (checkIds: number[]) =>
    api.post('/nutrition/stats/mark-notified/', { check_ids: checkIds }),

  // Export
  exportCsv: (params?: {
    program_id?: number
    client_id?: number
    type?: 'stats' | 'violations'
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.program_id) queryParams.set('program_id', String(params.program_id))
    if (params?.client_id) queryParams.set('client_id', String(params.client_id))
    if (params?.type) queryParams.set('type', params.type)

    const url = `/nutrition/stats/export-csv/?${queryParams.toString()}`
    return api.get(url, { responseType: 'blob' })
  },
}
