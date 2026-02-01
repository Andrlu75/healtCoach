/**
 * Компонент превью блюда для отображения в программе питания.
 *
 * Компактное отображение: название, КБЖУ, миниатюра фото, кнопка удаления.
 */

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DishPreviewData {
  id?: number
  name: string
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
  photo?: string | null
  portion_weight?: number
}

interface DishPreviewProps {
  /** Данные блюда */
  dish: DishPreviewData
  /** Callback при удалении блюда */
  onRemove?: () => void
  /** Показывать кнопку удаления */
  showRemove?: boolean
  /** Callback при клике на блюдо */
  onClick?: () => void
}

export function DishPreview({
  dish,
  onRemove,
  showRemove = true,
  onClick,
}: DishPreviewProps) {
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border ${
        onClick ? 'cursor-pointer hover:bg-muted/80 transition-colors' : ''
      }`}
      onClick={onClick}
    >
      {/* Миниатюра фото */}
      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-muted overflow-hidden">
        {dish.photo ? (
          <img
            src={dish.photo}
            alt={dish.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <svg
              className="w-5 h-5"
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

      {/* Информация о блюде */}
      <div className="flex-1 min-w-0">
        {/* Название */}
        <div className="font-medium text-sm truncate">{dish.name}</div>

        {/* КБЖУ */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {Math.round(dish.calories)} ккал
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span>Б: {Math.round(dish.proteins)}г</span>
          <span>Ж: {Math.round(dish.fats)}г</span>
          <span>У: {Math.round(dish.carbohydrates)}г</span>
          {dish.portion_weight && dish.portion_weight > 0 && (
            <>
              <span className="text-muted-foreground/60">•</span>
              <span>{dish.portion_weight}г</span>
            </>
          )}
        </div>
      </div>

      {/* Кнопка удаления */}
      {showRemove && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

/**
 * Компактная версия превью для списков.
 */
interface DishPreviewCompactProps {
  name: string
  calories: number
  onClick?: () => void
}

export function DishPreviewCompact({
  name,
  calories,
  onClick,
}: DishPreviewCompactProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-2 py-1 rounded bg-muted/50 text-sm ${
        onClick ? 'cursor-pointer hover:bg-muted transition-colors' : ''
      }`}
      onClick={onClick}
    >
      <span className="font-medium truncate max-w-[150px]">{name}</span>
      <span className="text-muted-foreground text-xs">
        {Math.round(calories)} ккал
      </span>
    </div>
  )
}
