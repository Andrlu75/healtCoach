/**
 * API клиент для работы с базой блюд, продуктов и тегов.
 */

import api from './client'
import type {
  Dish,
  DishFormData,
  DishListItem,
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
