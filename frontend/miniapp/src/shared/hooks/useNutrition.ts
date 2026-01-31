import { useQuery } from '@tanstack/react-query'
import {
  getNutritionProgramToday,
  getNutritionProgramHistory,
  getNutritionProgramSummary,
  getNutritionProgramViolations,
} from '../../api/endpoints'

export const useNutritionProgramToday = () => {
  return useQuery({
    queryKey: ['nutritionProgramToday'],
    queryFn: async () => {
      const { data } = await getNutritionProgramToday()
      return data
    },
  })
}

export const useNutritionProgramHistory = () => {
  return useQuery({
    queryKey: ['nutritionProgramHistory'],
    queryFn: async () => {
      const { data } = await getNutritionProgramHistory()
      return data
    },
  })
}

export const useNutritionProgramSummary = () => {
  return useQuery({
    queryKey: ['nutritionProgramSummary'],
    queryFn: async () => {
      const { data } = await getNutritionProgramSummary()
      return data
    },
  })
}

export const useNutritionProgramViolations = (params?: { limit?: number }) => {
  return useQuery({
    queryKey: ['nutritionProgramViolations', params],
    queryFn: async () => {
      const { data } = await getNutritionProgramViolations(params)
      return data
    },
  })
}
