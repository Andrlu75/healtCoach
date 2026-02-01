/**
 * Карточка блюда для отображения в списке базы блюд.
 */

import { Clock, Copy, MoreVertical, Pencil, Archive } from 'lucide-react'
import type { DishListItem } from '@/types/dishes'
import { MEAL_TYPE_LABELS } from '@/types/dishes'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DishCardProps {
  dish: DishListItem
  onClick?: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onArchive?: () => void
}

export function DishCard({ dish, onClick, onEdit, onDuplicate, onArchive }: DishCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Не открываем при клике на dropdown
    if ((e.target as HTMLElement).closest('[data-dropdown]')) return
    onClick?.()
  }

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={handleCardClick}
    >
      {/* Фото блюда */}
      <div className="relative aspect-[4/3] bg-muted">
        {dish.photo ? (
          <img
            src={dish.photo}
            alt={dish.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <svg
              className="w-12 h-12"
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

        {/* Время приготовления */}
        {dish.cooking_time && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {dish.cooking_time} мин
          </div>
        )}

        {/* Dropdown меню */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" data-dropdown>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/90 hover:bg-white">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Дублировать
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive} className="text-destructive">
                <Archive className="mr-2 h-4 w-4" />
                Архивировать
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Контент карточки */}
      <div className="p-3 space-y-2">
        {/* Название */}
        <h3 className="font-medium text-sm line-clamp-2">{dish.name}</h3>

        {/* КБЖУ */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{Math.round(dish.calories)} ккал</span>
          <span>Б: {Math.round(dish.proteins)}г</span>
          <span>Ж: {Math.round(dish.fats)}г</span>
          <span>У: {Math.round(dish.carbohydrates)}г</span>
        </div>

        {/* Порция */}
        {dish.portion_weight > 0 && (
          <div className="text-xs text-muted-foreground">
            Порция: {dish.portion_weight}г
          </div>
        )}

        {/* Теги */}
        {dish.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {dish.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
              </span>
            ))}
            {dish.tags.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                +{dish.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Типы приёмов пищи */}
        {dish.meal_types.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {dish.meal_types.map((mt) => MEAL_TYPE_LABELS[mt]).join(', ')}
          </div>
        )}
      </div>
    </Card>
  )
}
