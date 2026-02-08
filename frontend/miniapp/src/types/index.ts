export * from './nutrition'

export interface ClientData {
  id: number
  first_name: string
  last_name: string
  gender: 'male' | 'female' | null
  age: number | null
  height: number | null
  weight: number | null
  daily_calories: number | null
  daily_proteins: number | null
  daily_fats: number | null
  daily_carbs: number | null
  daily_water: number | null
  onboarding_completed: boolean
  meal_analysis_mode: 'ask' | 'fast' | 'smart'
}

export interface ComplianceStatus {
  is_compliant: boolean
  found_forbidden: string[]
  ai_comment: string
}

export interface DetailedIngredient {
  name: string
  weight: number
  calories: number
  proteins: number
  fats: number
  carbs: number
}

export interface Meal {
  id: number
  dish_name: string
  dish_type: string
  calories: number | null
  proteins: number | null
  fats: number | null
  carbohydrates: number | null
  meal_time: string
  image?: string
  thumbnail?: string
  ingredients?: string[]
  health_analysis?: {
    estimated_weight?: number
    detailed_ingredients?: DetailedIngredient[]
    smart_mode?: boolean
  }
  compliance_status?: ComplianceStatus | null
}

export interface DailySummary {
  totals: {
    calories: number
    proteins: number
    fats: number
    carbs: number
  }
  water: number
  meals_count: number
}

export interface Reminder {
  id: number
  reminder_type: 'meal' | 'water' | 'supplement' | 'workout' | 'custom'
  message: string
  time: string
  frequency: 'daily' | 'weekdays' | 'custom'
  is_active: boolean
}

export interface Metric {
  id: number
  metric_type: 'weight' | 'water' | 'sleep' | 'steps'
  value: number
  recorded_at: string
}

export type UserRole = 'client' | 'coach'
