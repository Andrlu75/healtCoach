/**
 * API клиент для работы с базой блюд, продуктов и тегов.
 */

import api from './client'
import type {
  Dish,
  DishFormData,
  DishListParams,
  DishListResponse,
  DishTag,
  DishTagFormData,
  Product,
  ProductFormData,
  ProductListParams,
  ProductListResponse,
} from '../types/dishes'

const BASE_URL = '/meals'

// ============================================================================
// DISHES API
// ============================================================================

export const dishesApi = {
  /**
   * Получить список блюд с пагинацией и фильтрами.
   */
  async list(params?: DishListParams): Promise<DishListResponse> {
    const queryParams = new URLSearchParams()

    if (params?.page) queryParams.set('page', params.page.toString())
    if (params?.page_size) queryParams.set('page_size', params.page_size.toString())
    if (params?.search) queryParams.set('search', params.search)
    if (params?.meal_type) queryParams.set('meal_type', params.meal_type)
    if (params?.tags?.length) queryParams.set('tags', params.tags.join(','))
    if (params?.is_active !== undefined) queryParams.set('is_active', params.is_active.toString())
    if (params?.show_archived) queryParams.set('show_archived', 'true')
    if (params?.ordering) queryParams.set('ordering', params.ordering)

    const { data } = await api.get<DishListResponse>(
      `${BASE_URL}/dishes/?${queryParams.toString()}`
    )
    return data
  },

  /**
   * Получить блюдо по ID.
   */
  async get(id: number): Promise<Dish> {
    const { data } = await api.get<Dish>(`${BASE_URL}/dishes/${id}/`)
    return data
  },

  /**
   * Создать новое блюдо.
   */
  async create(formData: DishFormData): Promise<Dish> {
    const payload = prepareFormData(formData)
    const { data } = await api.post<Dish>(`${BASE_URL}/dishes/`, payload, {
      headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    })
    return data
  },

  /**
   * Обновить блюдо.
   */
  async update(id: number, formData: Partial<DishFormData>): Promise<Dish> {
    const payload = prepareFormData(formData)
    const { data } = await api.patch<Dish>(`${BASE_URL}/dishes/${id}/`, payload, {
      headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    })
    return data
  },

  /**
   * Удалить блюдо.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/dishes/${id}/`)
  },

  /**
   * Дублировать блюдо.
   */
  async duplicate(id: number): Promise<Dish> {
    const { data } = await api.post<Dish>(`${BASE_URL}/dishes/${id}/duplicate/`)
    return data
  },

  /**
   * Архивировать блюдо.
   */
  async archive(id: number): Promise<{ status: string; id: number }> {
    const { data } = await api.post<{ status: string; id: number }>(
      `${BASE_URL}/dishes/${id}/archive/`
    )
    return data
  },

  /**
   * Экспорт блюд в JSON.
   * Возвращает URL для скачивания файла.
   */
  async exportDishes(activeOnly = true): Promise<void> {
    const response = await api.get(`${BASE_URL}/dishes/export/`, {
      params: { active_only: activeOnly },
      responseType: 'blob',
    })

    // Создаём ссылку для скачивания
    const blob = new Blob([response.data], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'dishes_export.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  /**
   * Импорт блюд из JSON файла.
   */
  async importDishes(
    file: File,
    skipDuplicates = true
  ): Promise<DishImportResult> {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await api.post<DishImportResult>(
      `${BASE_URL}/dishes/import/?skip_duplicates=${skipDuplicates}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
    return data
  },
}

/**
 * Результат импорта блюд.
 */
export interface DishImportResult {
  status: string
  created_count: number
  skipped_count: number
  created_tags_count: number
  errors: Array<{ index: number; name: string; error: string }>
}

// ============================================================================
// PRODUCTS API
// ============================================================================

export const productsApi = {
  /**
   * Получить список продуктов с пагинацией и фильтрами.
   */
  async list(params?: ProductListParams): Promise<ProductListResponse> {
    const queryParams = new URLSearchParams()

    if (params?.page) queryParams.set('page', params.page.toString())
    if (params?.page_size) queryParams.set('page_size', params.page_size.toString())
    if (params?.search) queryParams.set('search', params.search)
    if (params?.category) queryParams.set('category', params.category)
    if (params?.is_verified !== undefined) {
      queryParams.set('is_verified', params.is_verified.toString())
    }
    if (params?.ordering) queryParams.set('ordering', params.ordering)

    const { data } = await api.get<ProductListResponse>(
      `${BASE_URL}/products/?${queryParams.toString()}`
    )
    return data
  },

  /**
   * Поиск продуктов для автокомплита.
   */
  async search(query: string): Promise<Product[]> {
    if (query.length < 2) return []
    const { data } = await api.get<Product[]>(`${BASE_URL}/products/search/?q=${encodeURIComponent(query)}`)
    return data
  },

  /**
   * Получить продукт по ID.
   */
  async get(id: number): Promise<Product> {
    const { data } = await api.get<Product>(`${BASE_URL}/products/${id}/`)
    return data
  },

  /**
   * Создать новый продукт.
   */
  async create(formData: ProductFormData): Promise<Product> {
    const { data } = await api.post<Product>(`${BASE_URL}/products/`, formData)
    return data
  },

  /**
   * Обновить продукт.
   */
  async update(id: number, formData: Partial<ProductFormData>): Promise<Product> {
    const { data } = await api.patch<Product>(`${BASE_URL}/products/${id}/`, formData)
    return data
  },

  /**
   * Удалить продукт.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/products/${id}/`)
  },
}

// ============================================================================
// DISH TAGS API
// ============================================================================

export const dishTagsApi = {
  /**
   * Получить все теги.
   */
  async list(): Promise<DishTag[]> {
    const { data } = await api.get<DishTag[]>(`${BASE_URL}/dish-tags/`)
    return data
  },

  /**
   * Создать новый тег.
   */
  async create(formData: DishTagFormData): Promise<DishTag> {
    const { data } = await api.post<DishTag>(`${BASE_URL}/dish-tags/`, formData)
    return data
  },

  /**
   * Обновить тег.
   */
  async update(id: number, formData: Partial<DishTagFormData>): Promise<DishTag> {
    const { data } = await api.patch<DishTag>(`${BASE_URL}/dish-tags/${id}/`, formData)
    return data
  },

  /**
   * Удалить тег.
   */
  async delete(id: number): Promise<void> {
    await api.delete(`${BASE_URL}/dish-tags/${id}/`)
  },
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Подготовить данные формы для отправки.
 * Если есть файл (photo), создаёт FormData.
 */
function prepareFormData(formData: Partial<DishFormData>): FormData | Record<string, unknown> {
  if (formData.photo instanceof File) {
    const fd = new FormData()

    Object.entries(formData).forEach(([key, value]) => {
      if (value === undefined || value === null) return

      if (key === 'photo' && value instanceof File) {
        fd.append('photo', value)
      } else if (Array.isArray(value)) {
        fd.append(key, JSON.stringify(value))
      } else if (typeof value === 'object') {
        fd.append(key, JSON.stringify(value))
      } else {
        fd.append(key, String(value))
      }
    })

    return fd
  }

  // Без файла - обычный JSON
  const result: Record<string, unknown> = {}
  Object.entries(formData).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value
    }
  })
  return result
}

// ============================================================================
// AI API
// ============================================================================

/**
 * Структура сгенерированного рецепта.
 */
export interface GeneratedRecipe {
  dish_name: string
  portion_weight: number
  cooking_time: number
  ingredients: Array<{
    name: string
    weight: number
    calories: number
    proteins: number
    fats: number
    carbohydrates: number
  }>
  recipe: string
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
}

/**
 * Структура КБЖУ.
 */
export interface NutritionData {
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
}

/**
 * Структура КБЖУ продукта на 100г.
 */
export interface ProductNutritionData {
  calories_per_100g: number
  proteins_per_100g: number
  fats_per_100g: number
  carbs_per_100g: number
}

export const dishesAiApi = {
  /**
   * Сгенерировать рецепт блюда по названию.
   */
  async generateRecipe(name: string): Promise<GeneratedRecipe> {
    const { data } = await api.post<GeneratedRecipe>(`${BASE_URL}/ai/generate-recipe/`, { name })
    return data
  },

  /**
   * Рассчитать КБЖУ по списку ингредиентов.
   */
  async calculateNutrition(
    ingredients: Array<{ name: string; weight: number }>
  ): Promise<NutritionData> {
    const { data } = await api.post<NutritionData>(`${BASE_URL}/ai/calculate-nutrition/`, {
      ingredients,
    })
    return data
  },

  /**
   * Сгенерировать описание блюда.
   */
  async suggestDescription(name: string): Promise<string> {
    const { data } = await api.post<{ description: string }>(
      `${BASE_URL}/ai/suggest-description/`,
      { name }
    )
    return data.description
  },

  /**
   * Подсказать КБЖУ продукта на 100г.
   */
  async suggestProductNutrition(name: string): Promise<ProductNutritionData> {
    const { data } = await api.post<ProductNutritionData>(
      `${BASE_URL}/ai/suggest-product-nutrition/`,
      { name }
    )
    return data
  },
}
