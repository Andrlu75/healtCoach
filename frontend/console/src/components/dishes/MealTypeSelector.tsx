/**
 * Компонент выбора типов приёмов пищи для блюда.
 *
 * Multiselect с toggle buttons для выбора подходящих приёмов пищи.
 */

import { MEAL_TYPE_LABELS, type MealType } from '@/types/dishes'
import { cn } from '@/lib/utils'

interface MealTypeSelectorProps {
  /** Выбранные типы приёмов пищи */
  selectedTypes: MealType[]
  /** Callback при изменении выбора */
  onChange: (types: MealType[]) => void
  /** Заблокировать выбор */
  disabled?: boolean
  /** Дополнительные классы */
  className?: string
}

const MEAL_TYPES_ORDER: MealType[] = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner']

export function MealTypeSelector({
  selectedTypes,
  onChange,
  disabled = false,
  className,
}: MealTypeSelectorProps) {
  const handleToggle = (mealType: MealType) => {
    if (disabled) return

    if (selectedTypes.includes(mealType)) {
      onChange(selectedTypes.filter((t) => t !== mealType))
    } else {
      onChange([...selectedTypes, mealType])
    }
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {MEAL_TYPES_ORDER.map((mealType) => {
        const isSelected = selectedTypes.includes(mealType)
        return (
          <button
            key={mealType}
            type="button"
            onClick={() => handleToggle(mealType)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              'border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {MEAL_TYPE_LABELS[mealType]}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Компактная версия с чекбоксами.
 */
interface MealTypeSelectorCompactProps {
  selectedTypes: MealType[]
  onChange: (types: MealType[]) => void
  disabled?: boolean
}

export function MealTypeSelectorCompact({
  selectedTypes,
  onChange,
  disabled = false,
}: MealTypeSelectorCompactProps) {
  const handleToggle = (mealType: MealType) => {
    if (disabled) return

    if (selectedTypes.includes(mealType)) {
      onChange(selectedTypes.filter((t) => t !== mealType))
    } else {
      onChange([...selectedTypes, mealType])
    }
  }

  return (
    <div className="space-y-2">
      {MEAL_TYPES_ORDER.map((mealType) => {
        const isSelected = selectedTypes.includes(mealType)
        return (
          <label
            key={mealType}
            className={cn(
              'flex items-center gap-2 cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleToggle(mealType)}
              disabled={disabled}
              className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
            />
            <span className="text-sm">{MEAL_TYPE_LABELS[mealType]}</span>
          </label>
        )
      })}
    </div>
  )
}
