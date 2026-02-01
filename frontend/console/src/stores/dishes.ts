/**
 * Zustand store для управления состоянием базы блюд.
 */

import { create } from 'zustand'
import { dishesApi, dishTagsApi, productsApi } from '../api/dishes'
import type {
  Dish,
  DishFilters,
  DishFormData,
  DishListItem,
  DishTag,
  DishTagFormData,
  Product,
  ProductFormData,
} from '../types/dishes'

// ============================================================================
// DISHES STORE
// ============================================================================

interface DishesState {
  // Данные
  dishes: DishListItem[]
  selectedDish: Dish | null
  tags: DishTag[]
  products: Product[]

  // Фильтры
  filters: DishFilters

  // Пагинация
  page: number
  hasMore: boolean
  totalCount: number

  // Состояние загрузки
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null

  // Actions - Dishes
  fetchDishes: (reset?: boolean) => Promise<void>
  loadMoreDishes: () => Promise<void>
  fetchDish: (id: number) => Promise<Dish>
  createDish: (data: DishFormData) => Promise<Dish>
  updateDish: (id: number, data: Partial<DishFormData>) => Promise<Dish>
  deleteDish: (id: number) => Promise<void>
  duplicateDish: (id: number) => Promise<Dish>
  archiveDish: (id: number) => Promise<void>

  // Actions - Filters
  setFilters: (filters: Partial<DishFilters>) => void
  resetFilters: () => void

  // Actions - Tags
  fetchTags: () => Promise<void>
  createTag: (data: DishTagFormData) => Promise<DishTag>
  updateTag: (id: number, data: Partial<DishTagFormData>) => Promise<DishTag>
  deleteTag: (id: number) => Promise<void>

  // Actions - Products
  fetchProducts: () => Promise<void>
  searchProducts: (query: string) => Promise<Product[]>
  createProduct: (data: ProductFormData) => Promise<Product>
  updateProduct: (id: number, data: Partial<ProductFormData>) => Promise<Product>
  deleteProduct: (id: number) => Promise<void>

  // Utils
  clearError: () => void
  reset: () => void
}

const DEFAULT_FILTERS: DishFilters = {
  search: '',
  mealType: null,
  tagIds: [],
  showArchived: false,
}

export const useDishesStore = create<DishesState>((set, get) => ({
  // Начальное состояние
  dishes: [],
  selectedDish: null,
  tags: [],
  products: [],
  filters: { ...DEFAULT_FILTERS },
  page: 1,
  hasMore: true,
  totalCount: 0,
  isLoading: false,
  isLoadingMore: false,
  error: null,

  // ========== DISHES ==========

  fetchDishes: async (reset = true) => {
    const { filters, page } = get()

    if (reset) {
      set({ isLoading: true, page: 1, dishes: [] })
    }

    try {
      const response = await dishesApi.list({
        page: reset ? 1 : page,
        search: filters.search || undefined,
        meal_type: filters.mealType || undefined,
        tags: filters.tagIds.length > 0 ? filters.tagIds : undefined,
        show_archived: filters.showArchived,
        ordering: '-updated_at',
      })

      set({
        dishes: reset ? response.results : [...get().dishes, ...response.results],
        hasMore: !!response.next,
        totalCount: response.count,
        isLoading: false,
        isLoadingMore: false,
        error: null,
      })
    } catch (err) {
      set({
        isLoading: false,
        isLoadingMore: false,
        error: err instanceof Error ? err.message : 'Ошибка загрузки блюд',
      })
    }
  },

  loadMoreDishes: async () => {
    const { hasMore, isLoadingMore, page } = get()
    if (!hasMore || isLoadingMore) return

    set({ isLoadingMore: true, page: page + 1 })
    await get().fetchDishes(false)
  },

  fetchDish: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      const dish = await dishesApi.get(id)
      set({ selectedDish: dish, isLoading: false })
      return dish
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Ошибка загрузки блюда',
      })
      throw err
    }
  },

  createDish: async (data: DishFormData) => {
    set({ isLoading: true, error: null })
    try {
      const dish = await dishesApi.create(data)
      // Добавляем в начало списка
      set((state) => ({
        dishes: [
          {
            id: dish.id,
            name: dish.name,
            photo: dish.photo,
            calories: dish.calories,
            proteins: dish.proteins,
            fats: dish.fats,
            carbohydrates: dish.carbohydrates,
            portion_weight: dish.portion_weight,
            meal_types: dish.meal_types,
            tags: dish.tags,
            cooking_time: dish.cooking_time,
            updated_at: dish.updated_at,
          },
          ...state.dishes,
        ],
        totalCount: state.totalCount + 1,
        isLoading: false,
      }))
      return dish
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Ошибка создания блюда',
      })
      throw err
    }
  },

  updateDish: async (id: number, data: Partial<DishFormData>) => {
    set({ isLoading: true, error: null })
    try {
      const dish = await dishesApi.update(id, data)
      // Обновляем в списке
      set((state) => ({
        dishes: state.dishes.map((d) =>
          d.id === id
            ? {
                ...d,
                name: dish.name,
                photo: dish.photo,
                calories: dish.calories,
                proteins: dish.proteins,
                fats: dish.fats,
                carbohydrates: dish.carbohydrates,
                portion_weight: dish.portion_weight,
                meal_types: dish.meal_types,
                tags: dish.tags,
                cooking_time: dish.cooking_time,
                updated_at: dish.updated_at,
              }
            : d
        ),
        selectedDish: dish,
        isLoading: false,
      }))
      return dish
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Ошибка обновления блюда',
      })
      throw err
    }
  },

  deleteDish: async (id: number) => {
    // Оптимистичное обновление
    const prevDishes = get().dishes
    set((state) => ({
      dishes: state.dishes.filter((d) => d.id !== id),
      totalCount: state.totalCount - 1,
    }))

    try {
      await dishesApi.delete(id)
    } catch (err) {
      // Откатываем при ошибке
      set({
        dishes: prevDishes,
        totalCount: prevDishes.length,
        error: err instanceof Error ? err.message : 'Ошибка удаления блюда',
      })
      throw err
    }
  },

  duplicateDish: async (id: number) => {
    set({ isLoading: true, error: null })
    try {
      const dish = await dishesApi.duplicate(id)
      // Добавляем копию в начало списка
      set((state) => ({
        dishes: [
          {
            id: dish.id,
            name: dish.name,
            photo: dish.photo,
            calories: dish.calories,
            proteins: dish.proteins,
            fats: dish.fats,
            carbohydrates: dish.carbohydrates,
            portion_weight: dish.portion_weight,
            meal_types: dish.meal_types,
            tags: dish.tags,
            cooking_time: dish.cooking_time,
            updated_at: dish.updated_at,
          },
          ...state.dishes,
        ],
        totalCount: state.totalCount + 1,
        isLoading: false,
      }))
      return dish
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Ошибка дублирования блюда',
      })
      throw err
    }
  },

  archiveDish: async (id: number) => {
    // Оптимистичное обновление
    const prevDishes = get().dishes
    set((state) => ({
      dishes: state.dishes.filter((d) => d.id !== id),
      totalCount: state.totalCount - 1,
    }))

    try {
      await dishesApi.archive(id)
    } catch (err) {
      // Откатываем при ошибке
      set({
        dishes: prevDishes,
        totalCount: prevDishes.length,
        error: err instanceof Error ? err.message : 'Ошибка архивирования блюда',
      })
      throw err
    }
  },

  // ========== FILTERS ==========

  setFilters: (newFilters: Partial<DishFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }))
    // Перезагружаем список с новыми фильтрами
    get().fetchDishes(true)
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } })
    get().fetchDishes(true)
  },

  // ========== TAGS ==========

  fetchTags: async () => {
    try {
      const tags = await dishTagsApi.list()
      set({ tags })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки тегов',
      })
    }
  },

  createTag: async (data: DishTagFormData) => {
    try {
      const tag = await dishTagsApi.create(data)
      set((state) => ({ tags: [...state.tags, tag] }))
      return tag
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка создания тега',
      })
      throw err
    }
  },

  updateTag: async (id: number, data: Partial<DishTagFormData>) => {
    try {
      const tag = await dishTagsApi.update(id, data)
      set((state) => ({
        tags: state.tags.map((t) => (t.id === id ? tag : t)),
      }))
      return tag
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка обновления тега',
      })
      throw err
    }
  },

  deleteTag: async (id: number) => {
    try {
      await dishTagsApi.delete(id)
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка удаления тега',
      })
      throw err
    }
  },

  // ========== PRODUCTS ==========

  fetchProducts: async () => {
    try {
      const response = await productsApi.list({ page_size: 100 })
      set({ products: response.results })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки продуктов',
      })
    }
  },

  searchProducts: async (query: string) => {
    try {
      return await productsApi.search(query)
    } catch {
      return []
    }
  },

  createProduct: async (data: ProductFormData) => {
    try {
      const product = await productsApi.create(data)
      set((state) => ({ products: [...state.products, product] }))
      return product
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка создания продукта',
      })
      throw err
    }
  },

  updateProduct: async (id: number, data: Partial<ProductFormData>) => {
    try {
      const product = await productsApi.update(id, data)
      set((state) => ({
        products: state.products.map((p) => (p.id === id ? product : p)),
      }))
      return product
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка обновления продукта',
      })
      throw err
    }
  },

  deleteProduct: async (id: number) => {
    try {
      await productsApi.delete(id)
      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      }))
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка удаления продукта',
      })
      throw err
    }
  },

  // ========== UTILS ==========

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      dishes: [],
      selectedDish: null,
      filters: { ...DEFAULT_FILTERS },
      page: 1,
      hasMore: true,
      totalCount: 0,
      isLoading: false,
      isLoadingMore: false,
      error: null,
    }),
}))
