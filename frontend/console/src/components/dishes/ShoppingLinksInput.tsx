/**
 * Компонент ввода ссылок на покупку продуктов.
 *
 * Динамический список ссылок с валидацией URL.
 */

import { useState } from 'react'
import { Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react'
import type { ShoppingLink } from '@/types/dishes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ShoppingLinksInputProps {
  /** Список ссылок */
  links: ShoppingLink[]
  /** Callback при изменении списка */
  onChange: (links: ShoppingLink[]) => void
  /** Заблокировать редактирование */
  disabled?: boolean
}

/**
 * Проверка валидности URL.
 */
function isValidUrl(url: string): boolean {
  if (!url.trim()) return true // Пустой URL разрешён
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function ShoppingLinksInput({
  links,
  onChange,
  disabled = false,
}: ShoppingLinksInputProps) {
  const [errors, setErrors] = useState<Record<number, string>>({})

  const handleAddLink = () => {
    if (disabled) return
    onChange([...links, { title: '', url: '' }])
  }

  const handleRemoveLink = (index: number) => {
    if (disabled) return
    const newLinks = links.filter((_, i) => i !== index)
    onChange(newLinks)

    // Удаляем ошибку для этого индекса
    const newErrors = { ...errors }
    delete newErrors[index]
    setErrors(newErrors)
  }

  const handleUpdateLink = (
    index: number,
    field: 'title' | 'url',
    value: string
  ) => {
    if (disabled) return

    const newLinks = links.map((link, i) => {
      if (i === index) {
        return { ...link, [field]: value }
      }
      return link
    })
    onChange(newLinks)

    // Валидация URL
    if (field === 'url') {
      const newErrors = { ...errors }
      if (!isValidUrl(value)) {
        newErrors[index] = 'Некорректный URL'
      } else {
        delete newErrors[index]
      }
      setErrors(newErrors)
    }
  }

  const handleOpenLink = (url: string) => {
    if (isValidUrl(url) && url.trim()) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="space-y-3">
      {/* Список ссылок */}
      {links.map((link, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              {/* Название */}
              <Input
                placeholder="Название (Ozon, Wildberries...)"
                value={link.title}
                onChange={(e) => handleUpdateLink(index, 'title', e.target.value)}
                disabled={disabled}
                className="h-9"
              />

              {/* URL */}
              <div className="relative">
                <Input
                  placeholder="https://..."
                  value={link.url}
                  onChange={(e) => handleUpdateLink(index, 'url', e.target.value)}
                  disabled={disabled}
                  className={cn(
                    'h-9 pr-10',
                    errors[index] && 'border-destructive focus-visible:ring-destructive'
                  )}
                />

                {/* Кнопка открытия ссылки */}
                {link.url && isValidUrl(link.url) && (
                  <button
                    type="button"
                    onClick={() => handleOpenLink(link.url)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Ошибка валидации */}
              {errors[index] && (
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="w-3 h-3" />
                  {errors[index]}
                </div>
              )}
            </div>

            {/* Кнопка удаления */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveLink(index)}
              disabled={disabled}
              className="flex-shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}

      {/* Кнопка добавления */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddLink}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Добавить ссылку
      </Button>

      {/* Подсказка */}
      {links.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Добавьте ссылки на магазины для покупки ингредиентов
        </p>
      )}
    </div>
  )
}
