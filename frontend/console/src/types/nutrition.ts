export type NutritionProgramStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface Ingredient {
  name: string
}

export type MealType = 'breakfast' | 'snack1' | 'lunch' | 'snack2' | 'dinner'

export interface ProgramMeal {
  id?: string
  type: MealType
  time: string
  name: string
  description: string
}

export interface NutritionProgramDay {
  id: number
  day_number: number
  date: string
  meals: ProgramMeal[]
  activity: string
  allowed_ingredients: Ingredient[]
  forbidden_ingredients: Ingredient[]
  notes: string
}

export interface NutritionProgram {
  id: number
  client: number
  client_name: string
  coach: number
  name: string
  description: string
  general_notes: string
  start_date: string
  end_date: string
  duration_days: number
  status: NutritionProgramStatus
  compliance_rate: number | null
  days_count: number
  current_day: number | null
  created_at: string
  updated_at: string
  days?: NutritionProgramDay[]
}

export interface MealComplianceCheck {
  id: number
  meal: number
  meal_name: string
  meal_time: string
  program_day: number
  day_number: number
  is_compliant: boolean
  found_forbidden: string[]
  found_allowed: string[]
  ai_comment: string
  coach_notified: boolean
  created_at: string
}

export interface ComplianceStats {
  program_id: number
  program_name: string
  client_name: string
  total_meals: number
  compliant_meals: number
  violations: number
  compliance_rate: number
  most_common_violations: string[]
}

export interface NutritionProgramListItem {
  id: number
  client: number
  client_name: string
  name: string
  status: NutritionProgramStatus
  start_date: string
  end_date: string
  duration_days: number
  current_day: number | null
  compliance_rate: number | null
  created_at: string
}

export interface NutritionProgramCreatePayload {
  client: number
  name: string
  description?: string
  general_notes?: string
  start_date: string
  duration_days: number
  days: NutritionProgramDayPayload[]
}

export interface NutritionProgramDayPayload {
  day_number: number
  meals?: ProgramMeal[]
  activity?: string
  allowed_ingredients: Ingredient[]
  forbidden_ingredients: Ingredient[]
  notes?: string
}

export interface NutritionProgramUpdatePayload {
  name?: string
  description?: string
  general_notes?: string
  status?: NutritionProgramStatus
  days?: NutritionProgramDayPayload[]
}
