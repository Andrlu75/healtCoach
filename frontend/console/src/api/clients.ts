import api from './client'
import type { Client } from '../types'

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const clientsApi = {
  list: (params?: { status?: string; search?: string }) =>
    api.get<PaginatedResponse<Client>>('/clients/', { params }),

  get: (id: number) => api.get<Client>(`/clients/${id}/`),

  update: (id: number, data: Partial<Client>) =>
    api.patch<Client>(`/clients/${id}/`, data),

  pause: (id: number) => api.post(`/clients/${id}/pause/`),
  activate: (id: number) => api.post(`/clients/${id}/activate/`),
  archive: (id: number) => api.post(`/clients/${id}/archive/`),
  setPersona: (id: number, persona_id: number | null) =>
    api.post<Client>(`/clients/${id}/set_persona/`, { persona_id }),
}
