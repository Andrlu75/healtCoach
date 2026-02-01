/**
 * Компонент выбора и создания тегов для блюда.
 *
 * Multiselect с chips, поиском и возможностью создания новых тегов.
 */

import { useState, useRef, useEffect } from 'react'
import { Plus, X, Check } from 'lucide-react'
import type { DishTag, DishTagFormData } from '@/types/dishes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface TagsInputProps {
  /** Выбранные теги */
  selectedTags: DishTag[]
  /** Все доступные теги */
  availableTags: DishTag[]
  /** Callback при изменении выбора */
  onChange: (tags: DishTag[]) => void
  /** Callback при создании нового тега */
  onCreateTag?: (data: DishTagFormData) => Promise<DishTag>
  /** Заблокировать выбор */
  disabled?: boolean
  /** Placeholder */
  placeholder?: string
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
]

export function TagsInput({
  selectedTags,
  availableTags,
  onChange,
  onCreateTag,
  disabled = false,
  placeholder = 'Выберите теги...',
}: TagsInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(DEFAULT_COLORS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Фильтрация тегов по поиску
  const filteredTags = availableTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedTags.some((st) => st.id === tag.id)
  )

  // Проверка: можно ли создать тег с таким именем
  const canCreateTag =
    newTagName.trim().length > 0 &&
    !availableTags.some(
      (tag) => tag.name.toLowerCase() === newTagName.trim().toLowerCase()
    )

  const handleToggleTag = (tag: DishTag) => {
    if (disabled) return

    const isSelected = selectedTags.some((st) => st.id === tag.id)
    if (isSelected) {
      onChange(selectedTags.filter((st) => st.id !== tag.id))
    } else {
      onChange([...selectedTags, tag])
    }
  }

  const handleRemoveTag = (tagId: number) => {
    if (disabled) return
    onChange(selectedTags.filter((st) => st.id !== tagId))
  }

  const handleCreateTag = async () => {
    if (!onCreateTag || !canCreateTag || isSubmitting) return

    setIsSubmitting(true)
    try {
      const newTag = await onCreateTag({
        name: newTagName.trim(),
        color: newTagColor,
      })
      onChange([...selectedTags, newTag])
      setNewTagName('')
      setNewTagColor(DEFAULT_COLORS[0])
      setIsCreating(false)
    } catch {
      // Ошибка обрабатывается в родительском компоненте
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  return (
    <div className="space-y-2">
      {/* Выбранные теги */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
              }}
            >
              {tag.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag.id)}
                  className="hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Popover с выбором тегов */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="w-full justify-start text-muted-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            {placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          {/* Поиск */}
          <div className="mb-2">
            <Input
              placeholder="Поиск тегов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Список тегов */}
          <div className="max-h-48 overflow-y-auto">
            {filteredTags.length > 0 ? (
              <div className="space-y-1">
                {filteredTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      handleToggleTag(tag)
                      setSearchQuery('')
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm text-left"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 truncate">{tag.name}</span>
                    {selectedTags.some((st) => st.id === tag.id) && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="text-sm text-muted-foreground text-center py-2">
                Теги не найдены
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-2">
                Нет доступных тегов
              </div>
            )}
          </div>

          {/* Создание нового тега */}
          {onCreateTag && (
            <div className="border-t mt-2 pt-2">
              {isCreating ? (
                <div className="space-y-2">
                  <Input
                    ref={inputRef}
                    placeholder="Название тега"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateTag()
                      } else if (e.key === 'Escape') {
                        setIsCreating(false)
                        setNewTagName('')
                      }
                    }}
                  />

                  {/* Выбор цвета */}
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className={cn(
                          'w-6 h-6 rounded-full transition-transform',
                          newTagColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  {/* Кнопки */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateTag}
                      disabled={!canCreateTag || isSubmitting}
                      className="flex-1"
                    >
                      {isSubmitting ? 'Создание...' : 'Создать'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsCreating(false)
                        setNewTagName('')
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreating(true)}
                  className="w-full justify-start text-muted-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Создать новый тег
                </Button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
