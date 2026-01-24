import api from './client'
import type { Client } from '../types'

export const clientsApi = {
  list: (params?: { status?: string; search?: string }) =>
    api.get<Client[]>('/clients/', { params }),

  get: (id: number) => api.get<Client>(`/clients/${id}/`),

  update: (id: number, data: Partial<Client>) =>
    api.patch<Client>(`/clients/${id}/`, data),

  pause: (id: number) => api.post(`/clients/${id}/pause/`),
  activate: (id: number) => api.post(`/clients/${id}/activate/`),
  archive: (id: number) => api.post(`/clients/${id}/archive/`),
}
