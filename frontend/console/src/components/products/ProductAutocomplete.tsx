/**
 * Компонент автокомплита для поиска и выбора продуктов.
 *
 * Debounced поиск через API с отображением КБЖУ.
 */

import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Loader2 } from 'lucide-react'
import type { Product } from '@/types/dishes'
import { PRODUCT_CATEGORY_LABELS } from '@/types/dishes'
import { productsApi } from '@/api/dishes'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface ProductAutocompleteProps {
  /** Выбранный продукт или null */
  value: Product | null
  /** Callback при выборе продукта */
  onChange: (product: Product | null) => void
  /** Callback при клике "Создать новый" */
  onCreateNew?: (searchQuery: string) => void
  /** Placeholder */
  placeholder?: string
  /** Заблокировать ввод */
  disabled?: boolean
  /** Дополнительные классы */
  className?: string
}

export function ProductAutocomplete({
  value,
  onChange,
  onCreateNew,
  placeholder = 'Поиск продукта...',
  disabled = false,
  className,
}: ProductAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<Product[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced поиск
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const products = await productsApi.search(query)
        setResults(products)
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (product: Product) => {
    onChange(product)
    setQuery('')
    setIsOpen(false)
    setResults([])
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
    if (value) {
      onChange(null)
    }
  }

  const handleCreateNew = () => {
    onCreateNew?.(query)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Выбранный продукт или поле ввода */}
      {value ? (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
          <div className="flex-1">
            <div className="font-medium text-sm">{value.name}</div>
            <div className="text-xs text-muted-foreground">
              {Math.round(value.calories_per_100g)} ккал / 100г
              {' • '}
              Б: {Math.round(value.proteins_per_100g)}г
              {' • '}
              Ж: {Math.round(value.fats_per_100g)}г
              {' • '}
              У: {Math.round(value.carbs_per_100g)}г
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
          >
            Изменить
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-9"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>
      )}

      {/* Dropdown с результатами */}
      {isOpen && !value && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-1">
              {results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelect(product)}
                  className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                >
                  <div className="font-medium text-sm">{product.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{Math.round(product.calories_per_100g)} ккал</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>Б: {Math.round(product.proteins_per_100g)}г</span>
                    <span>Ж: {Math.round(product.fats_per_100g)}г</span>
                    <span>У: {Math.round(product.carbs_per_100g)}г</span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{PRODUCT_CATEGORY_LABELS[product.category]}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 2 && !isLoading ? (
            <div className="p-3 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Продукты не найдены
              </p>
              {onCreateNew && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateNew}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Создать "{query}"
                </Button>
              )}
            </div>
          ) : query.length < 2 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Введите минимум 2 символа для поиска
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
