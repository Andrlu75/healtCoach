import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { nutritionProgramsApi } from '../api/nutritionPrograms'
import type {
  NutritionProgramCreatePayload,
  NutritionProgramDay,
  NutritionProgramUpdatePayload,
} from '../types/nutrition'

// Query Keys
export const nutritionProgramKeys = {
  all: ['nutrition-programs'] as const,
  lists: () => [...nutritionProgramKeys.all, 'list'] as const,
  list: (filters: { client?: number; status?: string; search?: string }) =>
    [...nutritionProgramKeys.lists(), filters] as const,
  details: () => [...nutritionProgramKeys.all, 'detail'] as const,
  detail: (id: number) => [...nutritionProgramKeys.details(), id] as const,
  days: (programId: number) =>
    [...nutritionProgramKeys.detail(programId), 'days'] as const,
  stats: (filters?: { program_id?: number; client_id?: number }) =>
    ['nutrition-stats', filters] as const,
  violations: (filters?: {
    program_id?: number
    client_id?: number
    notified?: boolean
  }) => ['nutrition-violations', filters] as const,
}

// List programs
export function useNutritionPrograms(filters?: {
  client?: number
  status?: string
  search?: string
}) {
  return useQuery({
    queryKey: nutritionProgramKeys.list(filters ?? {}),
    queryFn: async () => {
      const response = await nutritionProgramsApi.list(filters)
      return response.data
    },
  })
}

// Get single program
export function useNutritionProgram(id: number) {
  return useQuery({
    queryKey: nutritionProgramKeys.detail(id),
    queryFn: async () => {
      const response = await nutritionProgramsApi.get(id)
      return response.data
    },
    enabled: !!id,
  })
}

// Get program days
export function useNutritionProgramDays(programId: number) {
  return useQuery({
    queryKey: nutritionProgramKeys.days(programId),
    queryFn: async () => {
      const response = await nutritionProgramsApi.getDays(programId)
      return response.data
    },
    enabled: !!programId,
  })
}

// Create program
export function useCreateNutritionProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: NutritionProgramCreatePayload) => {
      const response = await nutritionProgramsApi.create(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nutritionProgramKeys.lists() })
    },
  })
}

// Update program
export function useUpdateNutritionProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: NutritionProgramUpdatePayload
    }) => {
      const response = await nutritionProgramsApi.update(id, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: nutritionProgramKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: nutritionProgramKeys.lists() })
    },
  })
}

// Delete program
export function useDeleteNutritionProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await nutritionProgramsApi.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: nutritionProgramKeys.lists() })
    },
  })
}

// Activate program
export function useActivateNutritionProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await nutritionProgramsApi.activate(id)
      return response.data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: nutritionProgramKeys.detail(id),
      })
      queryClient.invalidateQueries({ queryKey: nutritionProgramKeys.lists() })
    },
  })
}

// Cancel program
export function useCancelNutritionProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await nutritionProgramsApi.cancel(id)
      return response.data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: nutritionProgramKeys.detail(id),
      })
      queryClient.invalidateQueries({ queryKey: nutritionProgramKeys.lists() })
    },
  })
}

// Complete program
export function useCompleteNutritionProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await nutritionProgramsApi.complete(id)
      return response.data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: nutritionProgramKeys.detail(id),
      })
      queryClient.invalidateQueries({ queryKey: nutritionProgramKeys.lists() })
    },
  })
}

// Update day
export function useUpdateNutritionProgramDay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      programId,
      dayId,
      data,
    }: {
      programId: number
      dayId: number
      data: Partial<NutritionProgramDay>
    }) => {
      const response = await nutritionProgramsApi.updateDay(
        programId,
        dayId,
        data
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: nutritionProgramKeys.days(variables.programId),
      })
      queryClient.invalidateQueries({
        queryKey: nutritionProgramKeys.detail(variables.programId),
      })
    },
  })
}

// Copy day
export function useCopyNutritionProgramDay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      programId,
      dayId,
      sourceDayId,
    }: {
      programId: number
      dayId: number
      sourceDayId: number
    }) => {
      const response = await nutritionProgramsApi.copyDay(
        programId,
        dayId,
        sourceDayId
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: nutritionProgramKeys.days(variables.programId),
      })
      queryClient.invalidateQueries({
        queryKey: nutritionProgramKeys.detail(variables.programId),
      })
    },
  })
}

// Stats
export function useComplianceStats(filters?: {
  program_id?: number
  client_id?: number
}) {
  return useQuery({
    queryKey: nutritionProgramKeys.stats(filters),
    queryFn: async () => {
      const response = await nutritionProgramsApi.getStats(filters)
      return response.data
    },
  })
}

// Violations
export function useComplianceViolations(filters?: {
  program_id?: number
  client_id?: number
  notified?: boolean
}) {
  return useQuery({
    queryKey: nutritionProgramKeys.violations(filters),
    queryFn: async () => {
      const response = await nutritionProgramsApi.getViolations(filters)
      return response.data
    },
  })
}

// Mark violations as notified
export function useMarkViolationsNotified() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (checkIds: number[]) => {
      const response = await nutritionProgramsApi.markNotified(checkIds)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['nutrition-violations'],
      })
    },
  })
}

// Export CSV
export function useExportCsv() {
  return useMutation({
    mutationFn: async (params?: {
      program_id?: number
      client_id?: number
      type?: 'stats' | 'violations'
    }) => {
      const response = await nutritionProgramsApi.exportCsv(params)
      return response.data
    },
    onSuccess: (data, variables) => {
      // Create download link
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download =
        variables?.type === 'violations'
          ? 'nutrition_violations.csv'
          : 'nutrition_stats.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    },
  })
}
