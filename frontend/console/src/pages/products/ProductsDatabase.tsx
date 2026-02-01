/**
 * Страница базы данных продуктов коуча.
 *
 * Таблица с продуктами, поиск, фильтрация по категории,
 * CRUD операции и AI-подсказка КБЖУ.
 */

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, Loader2, Sparkles, Check, X } from 'lucide-react'
import { productsApi, dishesAiApi } from '@/api/dishes'
import type { Product, ProductCategory, ProductListResponse } from '@/types/dishes'
import { PRODUCT_CATEGORY_LABELS } from '@/types/dishes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { ProductQuickAdd } from '@/components/products/ProductQuickAdd'

/** Категории для фильтра */
const CATEGORIES = Object.entries(PRODUCT_CATEGORY_LABELS) as [ProductCategory, string][]

/** Состояние редактирования строки */
interface EditingRow {
  id: number
  name: string
  category: ProductCategory
  calories_per_100g: number
  proteins_per_100g: number
  fats_per_100g: number
  carbs_per_100g: number
}

export default function ProductsDatabase() {
  const { toast } = useToast()

  // Данные
  const [products, setProducts] = useState<Product[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // Пагинация
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const PAGE_SIZE = 50

  // Фильтры
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all')

  // Состояния UI
  const [isLoading, setIsLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null)

  /**
   * Загрузка продуктов.
   */
  const fetchProducts = useCallback(async (resetPage = true) => {
    const currentPage = resetPage ? 1 : page

    if (resetPage) {
      setIsLoading(true)
      setPage(1)
    }

    try {
      const response: ProductListResponse = await productsApi.list({
        page: currentPage,
        page_size: PAGE_SIZE,
        search: searchQuery || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        ordering: 'name',
      })

      setProducts(resetPage ? response.results : [...products, ...response.results])
      setTotalCount(response.count)
      setHasMore(!!response.next)
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить продукты',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [page, searchQuery, categoryFilter, products, toast])

  // Загрузка при монтировании и изменении фильтров
  useEffect(() => {
    fetchProducts(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, categoryFilter])

  // Debounced поиск
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        setSearchQuery(searchInput)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, searchQuery])

  /**
   * Загрузка следующей страницы.
   */
  const loadMore = async () => {
    if (!hasMore || isLoading) return
    setPage((p) => p + 1)
    await fetchProducts(false)
  }

  /**
   * Обработка создания продукта.
   */
  const handleProductCreated = (product: Product) => {
    setProducts((prev) => [product, ...prev])
    setTotalCount((c) => c + 1)
    setIsAddOpen(false)
  }

  /**
   * Начало редактирования строки.
   */
  const startEditing = (product: Product) => {
    setEditingRow({
      id: product.id,
      name: product.name,
      category: product.category,
      calories_per_100g: product.calories_per_100g,
      proteins_per_100g: product.proteins_per_100g,
      fats_per_100g: product.fats_per_100g,
      carbs_per_100g: product.carbs_per_100g,
    })
  }

  /**
   * Отмена редактирования.
   */
  const cancelEditing = () => {
    setEditingRow(null)
  }

  /**
   * Сохранение изменений.
   */
  const saveEditing = async () => {
    if (!editingRow) return

    setIsSaving(true)
    try {
      const updated = await productsApi.update(editingRow.id, {
        name: editingRow.name,
        category: editingRow.category,
        calories_per_100g: editingRow.calories_per_100g,
        proteins_per_100g: editingRow.proteins_per_100g,
        fats_per_100g: editingRow.fats_per_100g,
        carbs_per_100g: editingRow.carbs_per_100g,
      })

      setProducts((prev) =>
        prev.map((p) => (p.id === editingRow.id ? updated : p))
      )
      setEditingRow(null)
      toast({
        title: 'Сохранено',
        description: `Продукт "${updated.name}" обновлён`,
      })
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить изменения',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * AI подсказка КБЖУ для редактируемого продукта.
   */
  const suggestNutrition = async () => {
    if (!editingRow || !editingRow.name.trim()) return

    setAiLoadingId(editingRow.id)
    try {
      const nutrition = await dishesAiApi.suggestProductNutrition(editingRow.name)
      setEditingRow((prev) =>
        prev
          ? {
              ...prev,
              calories_per_100g: Math.round(nutrition.calories_per_100g),
              proteins_per_100g: Math.round(nutrition.proteins_per_100g * 10) / 10,
              fats_per_100g: Math.round(nutrition.fats_per_100g * 10) / 10,
              carbs_per_100g: Math.round(nutrition.carbs_per_100g * 10) / 10,
            }
          : null
      )
      toast({
        title: 'КБЖУ заполнено',
        description: 'Проверьте и сохраните изменения',
      })
    } catch {
      toast({
        title: 'Ошибка AI',
        description: 'Не удалось получить подсказку КБЖУ',
        variant: 'destructive',
      })
    } finally {
      setAiLoadingId(null)
    }
  }

  /**
   * Удаление продукта.
   */
  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      await productsApi.delete(deleteId)
      setProducts((prev) => prev.filter((p) => p.id !== deleteId))
      setTotalCount((c) => c - 1)
      toast({
        title: 'Удалено',
        description: 'Продукт удалён из базы',
      })
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить продукт',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  /**
   * Обновление поля редактируемой строки.
   */
  const updateEditingField = (field: keyof EditingRow, value: string | number) => {
    setEditingRow((prev) => (prev ? { ...prev, [field]: value } : null))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">База продуктов</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'продукт' : totalCount < 5 ? 'продукта' : 'продуктов'}
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Добавить продукт
        </Button>
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

        {/* Категория */}
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as ProductCategory | 'all')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {CATEGORIES.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Сброс фильтров */}
        {(searchQuery || categoryFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('')
              setSearchQuery('')
              setCategoryFilter('all')
            }}
          >
            <X className="w-4 h-4 mr-2" />
            Сбросить
          </Button>
        )}
      </div>

      {/* Таблица */}
      <div className="flex-1 overflow-auto border rounded-md">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-1">Нет продуктов</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || categoryFilter !== 'all'
                ? 'Попробуйте изменить параметры поиска'
                : 'Добавьте первый продукт в базу'}
            </p>
            {!searchQuery && categoryFilter === 'all' && (
              <Button onClick={() => setIsAddOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить продукт
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Название</TableHead>
                <TableHead className="w-[150px]">Категория</TableHead>
                <TableHead className="text-right w-[80px]">Ккал</TableHead>
                <TableHead className="text-right w-[80px]">Белки</TableHead>
                <TableHead className="text-right w-[80px]">Жиры</TableHead>
                <TableHead className="text-right w-[80px]">Углев.</TableHead>
                <TableHead className="w-[120px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isEditing = editingRow?.id === product.id

                return (
                  <TableRow key={product.id}>
                    {/* Название */}
                    <TableCell className="font-medium">
                      {isEditing ? (
                        <Input
                          value={editingRow.name}
                          onChange={(e) => updateEditingField('name', e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        product.name
                      )}
                    </TableCell>

                    {/* Категория */}
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={editingRow.category}
                          onValueChange={(v) =>
                            updateEditingField('category', v as ProductCategory)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {PRODUCT_CATEGORY_LABELS[product.category]}
                        </span>
                      )}
                    </TableCell>

                    {/* Калории */}
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          value={editingRow.calories_per_100g || ''}
                          onChange={(e) =>
                            updateEditingField('calories_per_100g', parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-20 text-right"
                        />
                      ) : (
                        Math.round(product.calories_per_100g)
                      )}
                    </TableCell>

                    {/* Белки */}
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={editingRow.proteins_per_100g || ''}
                          onChange={(e) =>
                            updateEditingField('proteins_per_100g', parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-20 text-right"
                        />
                      ) : (
                        product.proteins_per_100g.toFixed(1)
                      )}
                    </TableCell>

                    {/* Жиры */}
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={editingRow.fats_per_100g || ''}
                          onChange={(e) =>
                            updateEditingField('fats_per_100g', parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-20 text-right"
                        />
                      ) : (
                        product.fats_per_100g.toFixed(1)
                      )}
                    </TableCell>

                    {/* Углеводы */}
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={editingRow.carbs_per_100g || ''}
                          onChange={(e) =>
                            updateEditingField('carbs_per_100g', parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-20 text-right"
                        />
                      ) : (
                        product.carbs_per_100g.toFixed(1)
                      )}
                    </TableCell>

                    {/* Действия */}
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={suggestNutrition}
                            disabled={aiLoadingId === product.id || isSaving}
                            title="Подсказать КБЖУ"
                          >
                            {aiLoadingId === product.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700"
                            onClick={saveEditing}
                            disabled={isSaving}
                            title="Сохранить"
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={cancelEditing}
                            disabled={isSaving}
                            title="Отменить"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEditing(product)}
                            title="Редактировать"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(product.id)}
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Загрузить ещё */}
      {hasMore && !isLoading && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={loadMore}>
            Загрузить ещё
          </Button>
        </div>
      )}

      {/* Модальное окно добавления */}
      <ProductQuickAdd
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onProductCreated={handleProductCreated}
      />

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить продукт?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Продукт будет удалён из базы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Удаление...
                </>
              ) : (
                'Удалить'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
