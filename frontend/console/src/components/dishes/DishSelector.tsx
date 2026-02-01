/**
 * Модальное окно выбора блюда для добавления в программу питания.
 */

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, X, Loader2, Plus, ExternalLink } from 'lucide-react'
import { dishesApi } from '@/api/dishes'
import type { DishListItem, MealType } from '@/types/dishes'
import { MEAL_TYPE_LABELS } from '@/types/dishes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DishSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (dish: DishListItem) => void
  mealType?: MealType | null
}

export function DishSelector({ isOpen, onClose, onSelect, mealType }: DishSelectorProps) {
  const [dishes, setDishes] = useState<DishListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(mealType || null)

  // Загрузка блюд
  const loadDishes = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await dishesApi.list({
        search: search || undefined,
        meal_type: selectedMealType || undefined,
        page_size: 50,
        ordering: '-updated_at',
      })
      setDishes(response.results)
    } catch (error) {
      console.error('Error loading dishes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [search, selectedMealType])

  // Загружаем при открытии модала
  useEffect(() => {
    if (isOpen) {
      loadDishes()
    }
  }, [isOpen, loadDishes])

  // Debounced поиск
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      loadDishes()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, isOpen, loadDishes])

  // Установка mealType при открытии
  useEffect(() => {
    if (isOpen && mealType) {
      setSelectedMealType(mealType)
    }
  }, [isOpen, mealType])

  const handleSelect = (dish: DishListItem) => {
    onSelect(dish)
    onClose()
  }

  const handleMealTypeChange = (value: string) => {
    setSelectedMealType(value === 'all' ? null : (value as MealType))
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Выбрать блюдо из базы</DialogTitle>
        </DialogHeader>

        {/* Фильтры */}
        <div className="flex items-center gap-3 py-3 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedMealType || 'all'} onValueChange={handleMealTypeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Тип приёма пищи" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все приёмы пищи</SelectItem>
              {Object.entries(MEAL_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Список блюд */}
        <div className="flex-1 overflow-auto py-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : dishes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {search ? 'Блюда не найдены' : 'В базе пока нет блюд'}
              </p>
              <Link to="/dishes/new" onClick={onClose}>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Создать новое блюдо
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dishes.map((dish) => (
                <button
                  key={dish.id}
                  onClick={() => handleSelect(dish)}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary hover:bg-accent/50 transition-colors text-left"
                >
                  {/* Миниатюра */}
                  <div className="w-16 h-16 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                    {dish.photo ? (
                      <img
                        src={dish.photo}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Информация */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-1">{dish.name}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {Math.round(dish.calories)} ккал
                      </span>
                      <span>|</span>
                      <span>Б: {Math.round(dish.proteins)}г</span>
                      <span>Ж: {Math.round(dish.fats)}г</span>
                      <span>У: {Math.round(dish.carbohydrates)}г</span>
                    </div>
                    {dish.portion_weight > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Порция: {dish.portion_weight}г
                      </div>
                    )}
                    {dish.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {dish.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {dish.tags.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{dish.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t">
          <Link to="/dishes/new" onClick={onClose} className="text-sm text-primary hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            Создать новое блюдо
          </Link>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
