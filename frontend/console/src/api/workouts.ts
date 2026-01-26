import api from './client'
import type {
  WorkoutTemplate,
  ClientWorkout,
  TrainingSchedule,
  TrainingProgram,
  WorkoutSession,
} from '../types'

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// Шаблоны тренировок
export const workoutTemplatesApi = {
  list: () => api.get<PaginatedResponse<WorkoutTemplate>>('/workouts/templates/'),
  get: (id: number) => api.get<WorkoutTemplate>(`/workouts/templates/${id}/`),
  create: (data: Partial<WorkoutTemplate>) =>
    api.post<WorkoutTemplate>('/workouts/templates/', data),
  update: (id: number, data: Partial<WorkoutTemplate>) =>
    api.patch<WorkoutTemplate>(`/workouts/templates/${id}/`, data),
  delete: (id: number) => api.delete(`/workouts/templates/${id}/`),
  duplicate: (id: number) =>
    api.post<WorkoutTemplate>(`/workouts/templates/${id}/duplicate/`),
  addBlock: (id: number, data: { name: string; block_type: string; order?: number }) =>
    api.post(`/workouts/templates/${id}/add_block/`, data),
}

// Блоки шаблонов
export const templateBlocksApi = {
  get: (id: number) => api.get(`/workouts/template-blocks/${id}/`),
  update: (id: number, data: Record<string, unknown>) =>
    api.patch(`/workouts/template-blocks/${id}/`, data),
  delete: (id: number) => api.delete(`/workouts/template-blocks/${id}/`),
  addExercise: (
    id: number,
    data: { exercise: number; parameters: Record<string, number>; rest_after?: number }
  ) => api.post(`/workouts/template-blocks/${id}/add_exercise/`, data),
  reorderExercises: (id: number, order: { id: number; order: number }[]) =>
    api.post(`/workouts/template-blocks/${id}/reorder_exercises/`, { order }),
}

// Тренировки клиента
export const clientWorkoutsApi = {
  list: (params?: { client?: number; status?: string; scheduled_date?: string }) =>
    api.get<PaginatedResponse<ClientWorkout>>('/workouts/client-workouts/', { params }),
  get: (id: number) => api.get<ClientWorkout>(`/workouts/client-workouts/${id}/`),
  create: (data: Partial<ClientWorkout>) =>
    api.post<ClientWorkout>('/workouts/client-workouts/', data),
  update: (id: number, data: Partial<ClientWorkout>) =>
    api.patch<ClientWorkout>(`/workouts/client-workouts/${id}/`, data),
  delete: (id: number) => api.delete(`/workouts/client-workouts/${id}/`),
  duplicate: (id: number) =>
    api.post<ClientWorkout>(`/workouts/client-workouts/${id}/duplicate/`),
  copyToClient: (id: number, clientId: number) =>
    api.post<ClientWorkout>(`/workouts/client-workouts/${id}/copy_to_client/`, {
      client_id: clientId,
    }),
  createFromTemplate: (data: {
    template_id: number
    client_id: number
    scheduled_date?: string
    scheduled_time?: string
  }) => api.post<ClientWorkout>('/workouts/client-workouts/create_from_template/', data),
}

// Блоки тренировок
export const workoutBlocksApi = {
  create: (data: { workout: number; name: string; block_type: string; order?: number }) =>
    api.post('/workouts/blocks/', data),
  update: (id: number, data: Record<string, unknown>) =>
    api.patch(`/workouts/blocks/${id}/`, data),
  delete: (id: number) => api.delete(`/workouts/blocks/${id}/`),
  addExercise: (
    id: number,
    data: { exercise: number; parameters: Record<string, number>; rest_after?: number }
  ) => api.post(`/workouts/blocks/${id}/add_exercise/`, data),
  addSuperset: (id: number, data: { name?: string; rounds?: number; rest_after?: number }) =>
    api.post(`/workouts/blocks/${id}/add_superset/`, data),
}

// Упражнения в тренировках
export const workoutExercisesApi = {
  update: (id: number, data: Record<string, unknown>) =>
    api.patch(`/workouts/exercises/${id}/`, data),
  delete: (id: number) => api.delete(`/workouts/exercises/${id}/`),
}

// Расписания
export const trainingSchedulesApi = {
  list: (params?: { client?: number; is_active?: boolean }) =>
    api.get<PaginatedResponse<TrainingSchedule>>('/workouts/schedules/', { params }),
  get: (id: number) => api.get<TrainingSchedule>(`/workouts/schedules/${id}/`),
  create: (data: Partial<TrainingSchedule>) =>
    api.post<TrainingSchedule>('/workouts/schedules/', data),
  update: (id: number, data: Partial<TrainingSchedule>) =>
    api.patch<TrainingSchedule>(`/workouts/schedules/${id}/`, data),
  delete: (id: number) => api.delete(`/workouts/schedules/${id}/`),
}

// Программы
export const trainingProgramsApi = {
  list: (params?: { client?: number; status?: string }) =>
    api.get<PaginatedResponse<TrainingProgram>>('/workouts/programs/', { params }),
  get: (id: number) => api.get<TrainingProgram>(`/workouts/programs/${id}/`),
  create: (data: Partial<TrainingProgram>) =>
    api.post<TrainingProgram>('/workouts/programs/', data),
  update: (id: number, data: Partial<TrainingProgram>) =>
    api.patch<TrainingProgram>(`/workouts/programs/${id}/`, data),
  delete: (id: number) => api.delete(`/workouts/programs/${id}/`),
  start: (id: number, startDate?: string) =>
    api.post(`/workouts/programs/${id}/start/`, { start_date: startDate }),
  pause: (id: number) => api.post(`/workouts/programs/${id}/pause/`),
  resume: (id: number) => api.post(`/workouts/programs/${id}/resume/`),
  complete: (id: number) => api.post(`/workouts/programs/${id}/complete/`),
  advanceWeek: (id: number) => api.post(`/workouts/programs/${id}/advance_week/`),
}

// Сессии
export const workoutSessionsApi = {
  list: (params?: { workout?: number }) =>
    api.get<PaginatedResponse<WorkoutSession>>('/workouts/sessions/', { params }),
  get: (id: number) => api.get<WorkoutSession>(`/workouts/sessions/${id}/`),
}
