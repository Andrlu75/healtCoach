export interface TodayNutritionStats {
  meals_count: number
  compliant_meals: number
  violations_count: number
}

export interface TodayNutritionProgram {
  program_id: number
  program_name: string
  day_number: number
  total_days: number
  date: string
  allowed_ingredients: string[]
  forbidden_ingredients: string[]
  notes: string
  today_stats: TodayNutritionStats
}

export interface NutritionMealViolation {
  meal_id: number
  meal_name: string
  meal_time: string
  found_forbidden: string[]
  ai_comment: string
}

export interface NutritionDayHistory {
  day_number: number
  date: string
  meals_count: number
  compliant_meals: number
  violations: NutritionMealViolation[]
}

export interface NutritionHistory {
  program_id: number
  program_name: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  start_date: string
  end_date: string
  total_days: number
  compliance_rate: number | null
  days: NutritionDayHistory[]
}

export interface NutritionProgramSummary {
  id: number
  name: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  current_day: number | null
  total_days: number
  compliance_rate: number | null
}
