import api from './client'

// Auth
export const telegramAuth = (initData: string) =>
  api.post('/auth/telegram/', { initData })

// Meals (client-facing)
export const getMeals = (params?: { date?: string }) =>
  api.get('/miniapp/meals/', { params })

export const getDailySummary = (params?: { date?: string }) =>
  api.get('/miniapp/meals/daily/', { params })

export const addMeal = (data: {
  dish_name: string
  dish_type: string
  calories?: number
  proteins?: number
  fats?: number
  carbohydrates?: number
}) => api.post('/miniapp/meals/', data)

export const addMealWithPhoto = (formData: FormData) =>
  api.post('/miniapp/meals/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

export interface MealAnalysisResult {
  dish_name: string
  dish_type: string
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
  ingredients?: string[]
  confidence?: number
  ai_response?: string
}

export const analyzeMealPhoto = (formData: FormData) =>
  api.post<MealAnalysisResult>('/miniapp/meals/analyze/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

export const recalculateMeal = (previousAnalysis: MealAnalysisResult, correction: string) =>
  api.post<MealAnalysisResult>('/miniapp/meals/recalculate/', {
    previous_analysis: previousAnalysis,
    correction,
  })

export const deleteMeal = (id: number) =>
  api.delete(`/miniapp/meals/${id}/`)

// ========== Умный режим ==========

export interface DraftIngredient {
  name: string
  weight: number
  calories: number
  proteins: number
  fats: number
  carbs: number
  is_ai_detected: boolean
  is_user_edited?: boolean  // Зафиксирован пользователем - не пересчитывается
}

export interface MealDraft {
  id: string
  dish_name: string
  dish_type: string
  estimated_weight: number
  ai_confidence: number
  ingredients: DraftIngredient[]
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
  image?: string
}

export const analyzeSmartMealPhoto = (formData: FormData) =>
  api.post<MealDraft>('/miniapp/meals/analyze-smart/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

export const getMealDraft = (draftId: string) =>
  api.get<MealDraft>(`/miniapp/meals/drafts/${draftId}/`)

export const updateMealDraft = (draftId: string, data: Partial<{
  dish_name: string
  dish_type: string
  estimated_weight: number
}>) => api.patch<MealDraft>(`/miniapp/meals/drafts/${draftId}/`, data)

export const confirmMealDraft = (draftId: string, programMealType?: string) =>
  api.post<{ status: string; meal_id: number; meal: MealAnalysisResult; ai_response?: string }>(
    `/miniapp/meals/drafts/${draftId}/confirm/`,
    programMealType ? { program_meal_type: programMealType } : {}
  )

export const cancelMealDraft = (draftId: string) =>
  api.delete(`/miniapp/meals/drafts/${draftId}/`)

export const addIngredientToDraft = (draftId: string, name: string) =>
  api.post<{ ingredient: DraftIngredient; draft: MealDraft }>(
    `/miniapp/meals/drafts/${draftId}/ingredients/`,
    { name }
  )

export const removeIngredientFromDraft = (draftId: string, index: number) =>
  api.delete<{ status: string; draft: MealDraft }>(
    `/miniapp/meals/drafts/${draftId}/ingredients/${index}/`
  )

export const updateIngredientInDraft = (
  draftId: string,
  index: number,
  data: Partial<{
    name: string
    weight: number
    calories: number
    proteins: number
    fats: number
    carbs: number
  }>
) =>
  api.patch<{ status: string; ingredient: DraftIngredient; draft: MealDraft }>(
    `/miniapp/meals/drafts/${draftId}/ingredients/${index}/`,
    data
  )

// Metrics
export const getMetrics = (params?: { metric_type?: string }) =>
  api.get('/miniapp/metrics/', { params })

export const addMetric = (data: { metric_type: string; value: number }) =>
  api.post('/miniapp/metrics/', data)

export const addWater = (amount: number) =>
  api.post('/miniapp/metrics/water/', { amount })

// Profile
export const getProfile = () =>
  api.get('/miniapp/profile/')

export const updateProfile = (data: Partial<{
  gender: 'male' | 'female'
  age: number
  height: number
  weight: number
  daily_calories: number
  daily_proteins: number
  daily_fats: number
  daily_carbs: number
  daily_water: number
  meal_analysis_mode: 'ask' | 'fast' | 'smart'
}>) => api.patch('/miniapp/profile/', data)

// Reminders (client-facing)
export const getReminders = () =>
  api.get('/miniapp/reminders/')

export const toggleReminder = (id: number, is_active: boolean) =>
  api.patch('/miniapp/reminders/', { id, is_active })

// Onboarding
export interface OnboardingQuestion {
  id: number
  text: string
  type: 'text' | 'number' | 'choice' | 'multi_choice' | 'date'
  options: string[]
  is_required: boolean
  field_key: string
}

export interface OnboardingQuestionsResponse {
  questions: OnboardingQuestion[]
  client: {
    first_name: string
    onboarding_completed: boolean
  }
}

export const getOnboardingQuestions = () =>
  api.get<OnboardingQuestionsResponse>('/miniapp/onboarding/questions/')

export const submitOnboarding = (answers: Record<string, unknown>) =>
  api.post('/miniapp/onboarding/submit/', { answers })

// Nutrition Programs
import type {
  TodayNutritionProgram,
  NutritionHistory,
  NutritionProgramSummary,
} from '../types/nutrition'

export interface NutritionViolation {
  id: number
  meal_id: number
  meal_name: string
  meal_time: string
  program_name: string
  day_number: number
  found_forbidden: string[]
  ai_comment: string
  created_at: string
}

export const getNutritionProgramToday = () =>
  api.get<TodayNutritionProgram & { has_program: boolean }>('/miniapp/nutrition-program/today/')

export const getNutritionProgramHistory = () =>
  api.get<NutritionHistory & { has_program: boolean }>('/miniapp/nutrition-program/history/')

export const getNutritionProgramViolations = (params?: { limit?: number }) =>
  api.get<{ violations: NutritionViolation[] }>('/miniapp/nutrition-program/violations/', { params })

export const getNutritionProgramSummary = () =>
  api.get<NutritionProgramSummary & { has_program: boolean }>('/miniapp/nutrition-program/summary/')

// Shopping List
export interface ShoppingCategory {
  name: string
  emoji: string
  items: string[]
}

export interface ShoppingList {
  has_program: boolean
  program_name?: string
  days_count?: number
  start_date?: string
  end_date?: string
  categories: ShoppingCategory[]
  items_count: number
}

export const getShoppingList = (params?: { days?: number }) =>
  api.get<ShoppingList>('/miniapp/nutrition-program/shopping-list/', { params })

// Meal Reports
export interface MealReport {
  id: number
  program_day: number
  meal_type: string
  meal_type_display: string
  meal_time: string
  photo_file_id?: string
  photo_url?: string
  planned_description: string
  recognized_ingredients: Array<{ name: string }>
  is_compliant: boolean
  compliance_score: number
  ai_analysis: string
  program_name: string
  day_number: number
  created_at: string
}

export const getNutritionProgramMealReports = (params?: { date?: string }) =>
  api.get<{ date: string; day_number: number; reports: MealReport[] }>(
    '/miniapp/nutrition-program/meal-reports/',
    { params }
  )

export const createMealReport = (data: {
  meal_type: string
  photo_file_id?: string
  photo_url?: string
  photo_base64?: string
}) =>
  api.post<MealReport>('/miniapp/nutrition-program/meal-report/', data)

export const getMealReportPhoto = (reportId: number) =>
  api.get<Blob>(`/miniapp/nutrition-program/meal-report/${reportId}/photo/`, {
    responseType: 'blob',
  })
