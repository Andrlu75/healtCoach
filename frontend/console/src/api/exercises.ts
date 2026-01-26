import api from './client'
import type { ExerciseCategory, ExerciseType, Exercise } from '../types'

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const exerciseCategoriesApi = {
  list: () => api.get<ExerciseCategory[]>('/exercises/categories/'),
  get: (id: number) => api.get<ExerciseCategory>(`/exercises/categories/${id}/`),
  create: (data: Partial<ExerciseCategory>) =>
    api.post<ExerciseCategory>('/exercises/categories/', data),
  update: (id: number, data: Partial<ExerciseCategory>) =>
    api.patch<ExerciseCategory>(`/exercises/categories/${id}/`, data),
  delete: (id: number) => api.delete(`/exercises/categories/${id}/`),
  reorder: (order: { id: number; order: number }[]) =>
    api.post('/exercises/categories/reorder/', { order }),
}

export const exerciseTypesApi = {
  list: () => api.get<ExerciseType[]>('/exercises/types/'),
  get: (id: number) => api.get<ExerciseType>(`/exercises/types/${id}/`),
  create: (data: Partial<ExerciseType>) =>
    api.post<ExerciseType>('/exercises/types/', data),
  update: (id: number, data: Partial<ExerciseType>) =>
    api.patch<ExerciseType>(`/exercises/types/${id}/`, data),
  delete: (id: number) => api.delete(`/exercises/types/${id}/`),
  parameterOptions: () =>
    api.get<{ key: string; label: string }[]>('/exercises/types/parameter_options/'),
}

export const exercisesApi = {
  list: (params?: {
    category?: number
    exercise_type?: number
    difficulty?: string
    search?: string
  }) => api.get<PaginatedResponse<Exercise>>('/exercises/', { params }),

  get: (id: number) => api.get<Exercise>(`/exercises/${id}/`),

  create: (data: FormData) =>
    api.post<Exercise>('/exercises/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: number, data: FormData) =>
    api.patch<Exercise>(`/exercises/${id}/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: number) => api.delete(`/exercises/${id}/`),

  duplicate: (id: number) => api.post<Exercise>(`/exercises/${id}/duplicate/`),

  byCategory: () =>
    api.get<{ category: ExerciseCategory; exercises: Exercise[] }[]>(
      '/exercises/by_category/'
    ),
}
