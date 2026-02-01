/**
 * Боковая панель с перетаскиваемыми блюдами для редактора программ питания.
 * DndContext должен быть в родительском компоненте.
 */

import { useEffect, useState, useCallback } from 'react'
import { Search, Loader2, ChevronRight, GripVertical } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { dishesApi } from '@/api/dishes'
import type { DishListItem, MealType } from '@/types/dishes'
import { MEAL_TYPE_LABELS } from '@/types/dishes'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DraggableDishesPanelProps {
  isOpen: boolean
  onToggle: () => void
}

// Компонент перетаскиваемой карточки блюда
function DraggableDishCard({ dish }: { dish: DishListItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `dish-${dish.id}`,
    data: { dish },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 p-2 rounded-lg border bg-card hover:border-primary/50 cursor-grab active:cursor-grabbing transition-colors ${
        isDragging ? 'shadow-lg ring-2 ring-primary' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      {/* Drag handle */}
      <div className="flex-shrink-0 text-muted-foreground mt-1">
        <GripVertical size={14} />
      </div>

      {/* Миниатюра */}
      <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
        {dish.photo ? (
          <img src={dish.photo} alt={dish.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Информация */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-medium line-clamp-1">{dish.name}</h4>
        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">{Math.round(dish.calories)}</span>
          <span>ккал</span>
          <span className="mx-0.5">|</span>
          <span>Б:{Math.round(dish.proteins)}</span>
          <span>Ж:{Math.round(dish.fats)}</span>
          <span>У:{Math.round(dish.carbohydrates)}</span>
        </div>
      </div>
    </div>
  )
}

// Компонент оверлея при перетаскивании (экспортируется для использования в DragOverlay)
export function DishDragOverlay({ dish }: { dish: DishListItem }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg border bg-card shadow-xl ring-2 ring-primary w-64">
      <div className="flex-shrink-0 text-muted-foreground mt-1">
        <GripVertical size={14} />
      </div>
      <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
        {dish.photo ? (
          <img src={dish.photo} alt={dish.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-medium line-clamp-1">{dish.name}</h4>
        <div className="text-[10px] text-muted-foreground">
          {Math.round(dish.calories)} ккал
        </div>
      </div>
    </div>
  )
}

export function DraggableDishesPanel({ isOpen, onToggle }: DraggableDishesPanelProps) {
  const [dishes, setDishes] = useState<DishListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null)

  // Загрузка блюд
  const loadDishes = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await dishesApi.list({
        search: search || undefined,
        meal_type: selectedMealType || undefined,
        page_size: 30,
        ordering: '-updated_at',
      })
      setDishes(response.results)
    } catch (error) {
      console.error('Error loading dishes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [search, selectedMealType])

  // Загружаем при открытии панели
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
  }, [search, selectedMealType, isOpen, loadDishes])

  const handleMealTypeChange = (value: string) => {
    setSelectedMealType(value === 'all' ? null : (value as MealType))
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="w-72 flex-shrink-0 border-l border-border bg-card/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-medium">База блюд</h3>
        <button
          onClick={onToggle}
          className="p-1 text-muted-foreground hover:text-foreground rounded"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Фильтры */}
      <div className="p-2 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>

        <Select value={selectedMealType || 'all'} onValueChange={handleMealTypeChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Тип приёма" />
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
      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : dishes.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">
            {search ? 'Блюда не найдены' : 'В базе пока нет блюд'}
          </div>
        ) : (
          <div className="space-y-2">
            {dishes.map((dish) => (
              <DraggableDishCard key={dish.id} dish={dish} />
            ))}
          </div>
        )}
      </div>

      {/* Подсказка */}
      <div className="p-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground text-center">
          Перетащите блюдо на приём пищи
        </p>
      </div>
    </div>
  )
}
