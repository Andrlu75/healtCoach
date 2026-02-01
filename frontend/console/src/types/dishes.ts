/**
 * Типы для базы данных блюд коуча.
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Типы приёмов пищи.
 */
export type MealType = 'breakfast' | 'snack1' | 'lunch' | 'snack2' | 'dinner'

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Завтрак',
  snack1: 'Перекус 1',
  lunch: 'Обед',
  snack2: 'Перекус 2',
  dinner: 'Ужин',
}

/**
 * Категории продуктов.
 */
export type ProductCategory =
  | 'dairy'
  | 'meat'
  | 'fish'
  | 'vegetables'
  | 'fruits'
  | 'grains'
  | 'nuts'
  | 'oils'
  | 'spices'
  | 'other'

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  dairy: 'Молочные продукты',
  meat: 'Мясо',
  fish: 'Рыба и морепродукты',
  vegetables: 'Овощи',
  fruits: 'Фрукты',
  grains: 'Крупы и злаки',
  nuts: 'Орехи и семена',
  oils: 'Масла и жиры',
  spices: 'Специи и приправы',
  other: 'Прочее',
}

// ============================================================================
// PRODUCT TYPES
// ============================================================================

/**
 * Продукт из базы данных коуча.
 */
export interface Product {
  id: number
  name: string
  calories_per_100g: number
  proteins_per_100g: number
  fats_per_100g: number
  carbs_per_100g: number
  category: ProductCategory
  is_verified: boolean
  created_at: string
  updated_at: string
}

/**
 * Данные для создания/редактирования продукта.
 */
export interface ProductFormData {
  name: string
  calories_per_100g: number
  proteins_per_100g: number
  fats_per_100g: number
  carbs_per_100g: number
  category: ProductCategory
  is_verified?: boolean
}

/**
 * Параметры для запроса списка продуктов.
 */
export interface ProductListParams {
  page?: number
  page_size?: number
  search?: string
  category?: ProductCategory
  is_verified?: boolean
  ordering?: 'name' | '-name' | 'category' | '-category' | 'created_at' | '-created_at'
}

// ============================================================================
// DISH TAG TYPES
// ============================================================================

/**
 * Тег для категоризации блюд.
 */
export interface DishTag {
  id: number
  name: string
  color: string
  created_at: string
}

/**
 * Данные для создания/редактирования тега.
 */
export interface DishTagFormData {
  name: string
  color: string
}

// ============================================================================
// INGREDIENT TYPES
// ============================================================================

/**
 * Ингредиент в блюде.
 */
export interface Ingredient {
  product_id?: number | null
  name: string
  weight: number
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
}

/**
 * Ссылка на покупку продукта.
 */
export interface ShoppingLink {
  title: string
  url: string
}

// ============================================================================
// DISH TYPES
// ============================================================================

/**
 * Блюдо из базы данных коуча (компактный вид для списка).
 */
export interface DishListItem {
  id: number
  name: string
  photo: string | null
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
  portion_weight: number
  meal_types: MealType[]
  tags: DishTag[]
  cooking_time: number | null
  updated_at: string
}

/**
 * Полная информация о блюде.
 */
export interface Dish {
  id: number
  name: string
  description: string
  recipe: string
  portion_weight: number
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
  cooking_time: number | null
  photo: string | null
  video_url: string
  ingredients: Ingredient[]
  shopping_links: ShoppingLink[]
  meal_types: MealType[]
  tags: DishTag[]
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Данные для создания/редактирования блюда.
 */
export interface DishFormData {
  name: string
  description?: string
  recipe?: string
  portion_weight?: number
  calories?: number
  proteins?: number
  fats?: number
  carbohydrates?: number
  cooking_time?: number | null
  photo?: File | null
  video_url?: string
  ingredients?: Ingredient[]
  shopping_links?: ShoppingLink[]
  meal_types?: MealType[]
  tag_ids?: number[]
  is_active?: boolean
}

/**
 * Параметры для запроса списка блюд.
 */
export interface DishListParams {
  page?: number
  page_size?: number
  search?: string
  meal_type?: MealType
  tags?: number[]
  is_active?: boolean
  show_archived?: boolean
  ordering?: 'updated_at' | '-updated_at' | 'name' | '-name' | 'calories' | '-calories'
}

/**
 * Фильтры для списка блюд.
 */
export interface DishFilters {
  search: string
  mealType: MealType | null
  tagIds: number[]
  showArchived: boolean
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Пагинированный ответ API.
 */
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type DishListResponse = PaginatedResponse<DishListItem>
export type ProductListResponse = PaginatedResponse<Product>
