/**
 * Страница базы данных блюд коуча.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, X, Loader2, Download, Upload } from 'lucide-react'
import { useDishesStore } from '@/stores/dishes'
import { dishesApi, type DishImportResult } from '@/api/dishes'
import { MEAL_TYPE_LABELS, type MealType } from '@/types/dishes'
import { DishCard } from '@/components/dishes/DishCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

export default function DishesDatabase() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    dishes,
    tags,
    filters,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    fetchDishes,
    fetchTags,
    loadMoreDishes,
    setFilters,
    resetFilters,
    duplicateDish,
    archiveDish,
  } = useDishesStore()

  // Загружаем данные при монтировании
  useEffect(() => {
    fetchDishes()
    fetchTags()
  }, [fetchDishes, fetchTags])

  // Debounced поиск
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters({ search: searchInput })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, filters.search, setFilters])

  const handleMealTypeChange = (value: string) => {
    setFilters({ mealType: value === 'all' ? null : (value as MealType) })
  }

  const handleTagChange = (value: string) => {
    const tagId = parseInt(value, 10)
    if (tagId === 0) {
      setFilters({ tagIds: [] })
    } else {
      setFilters({ tagIds: [tagId] })
    }
  }

  const handleShowArchivedChange = () => {
    setFilters({ showArchived: !filters.showArchived })
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore && !isLoadingMore) {
      loadMoreDishes()
    }
  }

  const hasActiveFilters = filters.search || filters.mealType || filters.tagIds.length > 0

  // Экспорт блюд
  const handleExport = async () => {
    setIsExporting(true)
    try {
      await dishesApi.exportDishes(!filters.showArchived)
      toast({ title: 'Блюда успешно экспортированы' })
    } catch (err) {
      toast({ title: 'Ошибка экспорта блюд', variant: 'destructive' })
      console.error('Export error:', err)
    } finally {
      setIsExporting(false)
    }
  }

  // Импорт блюд
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Проверяем тип файла
    if (!file.name.endsWith('.json')) {
      toast({ title: 'Выберите JSON файл', variant: 'destructive' })
      return
    }

    setIsImporting(true)
    try {
      const result: DishImportResult = await dishesApi.importDishes(file, true)

      if (result.created_count > 0) {
        toast({
          title: 'Импорт завершён',
          description:
            `Импортировано ${result.created_count} блюд` +
            (result.created_tags_count > 0 ? ` и ${result.created_tags_count} тегов` : ''),
        })
        // Перезагружаем список
        fetchDishes()
        fetchTags()
      } else if (result.skipped_count > 0) {
        toast({ title: `Пропущено ${result.skipped_count} дубликатов` })
      }

      if (result.errors.length > 0) {
        toast({
          title: `Ошибки при импорте: ${result.errors.length}`,
          variant: 'destructive',
        })
        console.error('Import errors:', result.errors)
      }
    } catch (err) {
      toast({ title: 'Ошибка импорта блюд', variant: 'destructive' })
      console.error('Import error:', err)
    } finally {
      setIsImporting(false)
      // Сбрасываем input для повторного выбора того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">База блюд</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'блюдо' : totalCount < 5 ? 'блюда' : 'блюд'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Скрытый input для загрузки файла */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Кнопка импорта */}
          <Button
            variant="outline"
            onClick={handleImportClick}
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Импорт
          </Button>

          {/* Кнопка экспорта */}
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || totalCount === 0}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Экспорт
          </Button>

          {/* Кнопка добавления */}
          <Button onClick={() => navigate('/dishes/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Добавить блюдо
          </Button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap items-center gap-3 py-4">
        {/* Поиск */}
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Тип приёма пищи */}
        <Select value={filters.mealType || 'all'} onValueChange={handleMealTypeChange}>
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

        {/* Теги */}
        {tags.length > 0 && (
          <Select value={filters.tagIds[0]?.toString() || '0'} onValueChange={handleTagChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Тег" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Все теги</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Показать архив */}
        <Button
          variant={filters.showArchived ? 'secondary' : 'outline'}
          size="sm"
          onClick={handleShowArchivedChange}
        >
          <Filter className="w-4 h-4 mr-2" />
          Архив
        </Button>

        {/* Сбросить фильтры */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="w-4 h-4 mr-2" />
            Сбросить
          </Button>
        )}
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-auto" onScroll={handleScroll}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : dishes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
              <svg
                className="w-8 h-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-1">Нет блюд</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasActiveFilters
                ? 'Попробуйте изменить параметры поиска'
                : 'Создайте своё первое блюдо для базы'}
            </p>
            {!hasActiveFilters && (
              <Button onClick={() => navigate('/dishes/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить блюдо
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
              {dishes.map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  onClick={() => navigate(`/dishes/${dish.id}`)}
                  onEdit={() => navigate(`/dishes/${dish.id}`)}
                  onDuplicate={() => duplicateDish(dish.id)}
                  onArchive={() => archiveDish(dish.id)}
                />
              ))}
            </div>

            {/* Индикатор загрузки следующей страницы */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
