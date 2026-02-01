/**
 * Модальное окно для быстрого создания продукта.
 *
 * Позволяет создать продукт с КБЖУ прямо из формы блюда.
 * Включает AI-подсказку для автоматического заполнения КБЖУ.
 */

import { useState, useEffect } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Product, ProductCategory, ProductFormData } from '@/types/dishes'
import { PRODUCT_CATEGORY_LABELS } from '@/types/dishes'
import { productsApi, dishesAiApi } from '@/api/dishes'
import { useToast } from '@/components/ui/use-toast'

interface ProductQuickAddProps {
  /** Состояние открытия модального окна */
  isOpen: boolean
  /** Callback закрытия */
  onClose: () => void
  /** Callback после успешного создания продукта */
  onProductCreated: (product: Product) => void
  /** Начальное название продукта (из поиска) */
  initialName?: string
}

/** Начальные значения формы */
const INITIAL_FORM_DATA: ProductFormData = {
  name: '',
  category: 'other',
  calories_per_100g: 0,
  proteins_per_100g: 0,
  fats_per_100g: 0,
  carbs_per_100g: 0,
}

/** Категории продуктов для Select */
const CATEGORIES = Object.entries(PRODUCT_CATEGORY_LABELS) as [ProductCategory, string][]

export function ProductQuickAdd({
  isOpen,
  onClose,
  onProductCreated,
  initialName = '',
}: ProductQuickAddProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM_DATA)
  const [isLoading, setIsLoading] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({})

  // Установка начального названия при открытии
  useEffect(() => {
    if (isOpen) {
      setFormData({ ...INITIAL_FORM_DATA, name: initialName })
      setErrors({})
    }
  }, [isOpen, initialName])

  /**
   * Обновление поля формы.
   */
  const handleChange = (field: keyof ProductFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Очищаем ошибку при изменении поля
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  /**
   * Обновление числового поля формы.
   */
  const handleNumberChange = (field: keyof ProductFormData, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      handleChange(field, numValue)
    }
  }

  /**
   * Запрос AI для подсказки КБЖУ.
   */
  const handleAiSuggest = async () => {
    if (!formData.name.trim()) {
      setErrors((prev) => ({ ...prev, name: 'Введите название продукта' }))
      return
    }

    setIsAiLoading(true)
    try {
      const nutrition = await dishesAiApi.suggestProductNutrition(formData.name)
      setFormData((prev) => ({
        ...prev,
        calories_per_100g: Math.round(nutrition.calories_per_100g),
        proteins_per_100g: Math.round(nutrition.proteins_per_100g * 10) / 10,
        fats_per_100g: Math.round(nutrition.fats_per_100g * 10) / 10,
        carbs_per_100g: Math.round(nutrition.carbs_per_100g * 10) / 10,
      }))
      toast({
        title: 'КБЖУ заполнено',
        description: 'AI подсказал значения КБЖУ. Проверьте и скорректируйте при необходимости.',
      })
    } catch (error) {
      toast({
        title: 'Ошибка AI',
        description: 'Не удалось получить подсказку КБЖУ. Попробуйте позже.',
        variant: 'destructive',
      })
    } finally {
      setIsAiLoading(false)
    }
  }

  /**
   * Валидация формы.
   */
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProductFormData, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Название обязательно'
    }

    if (formData.calories_per_100g < 0) {
      newErrors.calories_per_100g = 'Калории не могут быть отрицательными'
    }

    if (formData.proteins_per_100g < 0) {
      newErrors.proteins_per_100g = 'Белки не могут быть отрицательными'
    }

    if (formData.fats_per_100g < 0) {
      newErrors.fats_per_100g = 'Жиры не могут быть отрицательными'
    }

    if (formData.carbs_per_100g < 0) {
      newErrors.carbs_per_100g = 'Углеводы не могут быть отрицательными'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * Сохранение продукта.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setIsLoading(true)
    try {
      const product = await productsApi.create(formData)
      toast({
        title: 'Продукт создан',
        description: `"${product.name}" добавлен в базу.`,
      })
      onProductCreated(product)
      onClose()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Не удалось создать продукт'
      toast({
        title: 'Ошибка',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Обработка закрытия модального окна.
   */
  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый продукт</DialogTitle>
          <DialogDescription>
            Добавьте продукт в базу для использования в ингредиентах блюд.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Название */}
          <div className="space-y-2">
            <Label htmlFor="product-name">Название</Label>
            <div className="flex gap-2">
              <Input
                id="product-name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Например: Куриная грудка"
                className={errors.name ? 'border-destructive' : ''}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAiSuggest}
                disabled={isLoading || isAiLoading || !formData.name.trim()}
                title="Подсказать КБЖУ с помощью AI"
              >
                {isAiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Категория */}
          <div className="space-y-2">
            <Label htmlFor="product-category">Категория</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => handleChange('category', value as ProductCategory)}
              disabled={isLoading}
            >
              <SelectTrigger id="product-category">
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* КБЖУ на 100г */}
          <div className="space-y-2">
            <Label>КБЖУ на 100г</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* Калории */}
              <div className="space-y-1">
                <Label htmlFor="product-calories" className="text-xs text-muted-foreground">
                  Калории, ккал
                </Label>
                <Input
                  id="product-calories"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.calories_per_100g || ''}
                  onChange={(e) => handleNumberChange('calories_per_100g', e.target.value)}
                  placeholder="0"
                  className={errors.calories_per_100g ? 'border-destructive' : ''}
                  disabled={isLoading}
                />
              </div>

              {/* Белки */}
              <div className="space-y-1">
                <Label htmlFor="product-proteins" className="text-xs text-muted-foreground">
                  Белки, г
                </Label>
                <Input
                  id="product-proteins"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.proteins_per_100g || ''}
                  onChange={(e) => handleNumberChange('proteins_per_100g', e.target.value)}
                  placeholder="0"
                  className={errors.proteins_per_100g ? 'border-destructive' : ''}
                  disabled={isLoading}
                />
              </div>

              {/* Жиры */}
              <div className="space-y-1">
                <Label htmlFor="product-fats" className="text-xs text-muted-foreground">
                  Жиры, г
                </Label>
                <Input
                  id="product-fats"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.fats_per_100g || ''}
                  onChange={(e) => handleNumberChange('fats_per_100g', e.target.value)}
                  placeholder="0"
                  className={errors.fats_per_100g ? 'border-destructive' : ''}
                  disabled={isLoading}
                />
              </div>

              {/* Углеводы */}
              <div className="space-y-1">
                <Label htmlFor="product-carbs" className="text-xs text-muted-foreground">
                  Углеводы, г
                </Label>
                <Input
                  id="product-carbs"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.carbs_per_100g || ''}
                  onChange={(e) => handleNumberChange('carbs_per_100g', e.target.value)}
                  placeholder="0"
                  className={errors.carbs_per_100g ? 'border-destructive' : ''}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Создать'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
