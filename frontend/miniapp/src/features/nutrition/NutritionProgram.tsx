import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, X, Check } from 'lucide-react'
import { getNutritionProgramToday, getShoppingList } from '../../api/endpoints'
import { Card, CardContent } from '../../shared/components/ui'
import { Skeleton } from '../../shared/components/feedback'

interface Meal {
  type: string
  time: string
  name: string
  description: string
}

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  snack1: '🍎',
  lunch: '🍽️',
  snack2: '🥜',
  dinner: '🌙',
}

const MEAL_COLORS: Record<string, { bg: string; border: string }> = {
  breakfast: { bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800' },
  snack1: { bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-800' },
  lunch: { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800' },
  snack2: { bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800' },
  dinner: { bg: 'bg-indigo-50 dark:bg-indigo-900/10', border: 'border-indigo-200 dark:border-indigo-800' },
}

// Хук для управления чеклистом (сохранение в localStorage)
function useShoppingChecklist(programId: number | undefined) {
  const storageKey = `shopping-checklist-${programId}`

  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    if (!programId) return new Set()
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    if (programId) {
      localStorage.setItem(storageKey, JSON.stringify([...checkedItems]))
    }
  }, [checkedItems, storageKey, programId])

  const toggleItem = (item: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(item)) {
        newSet.delete(item)
      } else {
        newSet.add(item)
      }
      return newSet
    })
  }

  const clearAll = () => setCheckedItems(new Set())

  return { checkedItems, toggleItem, clearAll }
}

function ShoppingListModal({
  programId,
  onClose,
}: {
  programId: number
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['shoppingList', programId],
    queryFn: async () => {
      const { data } = await getShoppingList({ days: 3 })
      return data
    },
  })

  const { checkedItems, toggleItem, clearAll } = useShoppingChecklist(programId)

  const categories = data?.categories || []
  const totalItems = data?.items_count || 0
  const checkedCount = [...checkedItems].length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
              <ShoppingCart size={24} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                Список покупок
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                На {data?.days_count || 3} дня • {totalItems} продуктов
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Progress */}
        {totalItems > 0 && (
          <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Куплено: {checkedCount} из {totalItems}
              </span>
              {checkedCount > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline"
                >
                  Сбросить
                </button>
              )}
            </div>
            <div className="h-2.5 bg-white/50 dark:bg-gray-800/50 rounded-full overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }}
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}

        {/* Categories list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : categories.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {categories.map((category) => (
                <div key={category.name} className="p-4">
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{category.emoji}</span>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                      {category.name}
                    </h3>
                    <span className="ml-auto text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {category.items.length}
                    </span>
                  </div>
                  {/* Items */}
                  <div className="space-y-1.5">
                    {category.items.map((item) => {
                      const isChecked = checkedItems.has(item)
                      return (
                        <motion.button
                          key={item}
                          onClick={() => toggleItem(item)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                            isChecked
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              isChecked
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {isChecked && <Check size={12} className="text-white" />}
                          </div>
                          <span
                            className={`flex-1 text-left text-sm transition-all ${
                              isChecked
                                ? 'text-gray-400 dark:text-gray-500 line-through'
                                : 'text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            {item}
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-4">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                <span className="text-4xl">🛒</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                Список пуст
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Добавьте блюда в программу питания
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-shadow"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function MealCard({ meal }: { meal: Meal }) {
  const colors = MEAL_COLORS[meal.type] || MEAL_COLORS.lunch
  const icon = MEAL_ICONS[meal.type] || '🍽️'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {meal.name}
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {meal.time}
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {meal.description}
        </p>
      </div>
    </motion.div>
  )
}

function NutritionProgram() {
  const navigate = useNavigate()
  const [showNotes, setShowNotes] = useState(false)
  const [showShoppingList, setShowShoppingList] = useState(false)

  const { data: todayData, isLoading, isError, refetch } = useQuery({
    queryKey: ['nutritionProgramToday'],
    queryFn: async () => {
      const { data } = await getNutritionProgramToday()
      return data
    },
  })

  if (isError) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Не удалось загрузить данные
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Проверьте подключение к интернету
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 active:bg-blue-700"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!todayData?.has_program) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-3xl">🥗</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Нет активной программы
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ваш коуч ещё не назначил программу питания
          </p>
        </div>
      </div>
    )
  }

  const progress = Math.round((todayData.day_number / todayData.total_days) * 100)
  const meals: Meal[] = todayData.meals || []

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Программа питания
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            День {todayData.day_number} из {todayData.total_days} • {todayData.program_name}
          </p>
        </div>
        {/* Кнопка списка покупок */}
        <button
          onClick={() => setShowShoppingList(true)}
          className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
        >
          <ShoppingCart size={18} />
          <span className="text-sm font-medium">Купить</span>
        </button>
      </div>

      {/* Progress bar */}
      <Card variant="elevated">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Прогресс программы</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {progress}%
            </span>
          </div>
          <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Activity recommendation */}
      {todayData.activity && (
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <span className="text-lg">🏃</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Активность на сегодня</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {todayData.activity}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meals */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-1">
          Меню на сегодня
        </h2>
        {meals.length > 0 ? (
          meals.map((meal, index) => (
            <MealCard key={`${meal.type}-${index}`} meal={meal} />
          ))
        ) : (
          <Card variant="elevated">
            <CardContent className="p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                Меню на сегодня пока не заполнено
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* General notes */}
      {todayData.general_notes && (
        <Card variant="elevated">
          <CardContent className="p-4">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="w-full flex items-center justify-between"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span>📋</span> Общие рекомендации
              </span>
              <motion.span
                animate={{ rotate: showNotes ? 180 : 0 }}
                className="text-gray-400"
              >
                ▼
              </motion.span>
            </button>
            <AnimatePresence>
              {showNotes && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {todayData.general_notes}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}

      {/* Day notes */}
      {todayData.notes && (
        <Card variant="elevated">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <span>💡</span> Заметка на день
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{todayData.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* History link */}
      <button
        onClick={() => navigate('/nutrition/history')}
        className="w-full py-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center justify-center gap-1"
      >
        История программы <span>→</span>
      </button>

      {/* Модальное окно списка покупок */}
      <AnimatePresence>
        {showShoppingList && todayData.program_id && (
          <ShoppingListModal
            programId={todayData.program_id}
            onClose={() => setShowShoppingList(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default NutritionProgram
