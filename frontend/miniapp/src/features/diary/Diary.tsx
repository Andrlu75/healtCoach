import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getMeals, getDailySummary } from '../../api/endpoints'
import { useAuthStore } from '../auth'
import { useHaptic } from '../../shared/hooks'
import { ListSkeleton } from '../../shared/components/feedback'
import { PullToRefresh } from '../../shared/components/feedback/PullToRefresh'
import { Card } from '../../shared/components/ui'
import { MealCard } from '../meals/components/MealCard'
import type { Meal } from '../../types'

function Diary() {
  const [date, setDate] = useState(dayjs())
  const [direction, setDirection] = useState(0)
  const { selection, notification } = useHaptic()
  const queryClient = useQueryClient()
  const client = useAuthStore((s) => s.client)

  const dateStr = date.format('YYYY-MM-DD')
  const isToday = date.isSame(dayjs(), 'day')

  const { data: meals, isLoading: mealsLoading, refetch: refetchMeals } = useQuery({
    queryKey: ['meals', dateStr],
    queryFn: () => getMeals({ date: dateStr }).then((r) => r.data),
  })

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['dailySummary', dateStr],
    queryFn: () => getDailySummary({ date: dateStr }).then((r) => r.data),
  })

  const totals = summary?.totals || { calories: 0, proteins: 0, fats: 0, carbs: 0 }

  const prevDay = () => {
    selection()
    setDirection(-1)
    setDate((d) => d.subtract(1, 'day'))
  }

  const nextDay = () => {
    if (!isToday) {
      selection()
      setDirection(1)
      setDate((d) => d.add(1, 'day'))
    }
  }

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchMeals(), refetchSummary()])
    notification('success')
  }, [refetchMeals, refetchSummary, notification])

  const handleMealDelete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['meals', dateStr] })
    queryClient.invalidateQueries({ queryKey: ['dailySummary', dateStr] })
    if (isToday) {
      queryClient.invalidateQueries({ queryKey: ['dailySummary'] })
    }
  }, [queryClient, dateStr, isToday])

  // Calculate progress percentages
  const getProgress = (current: number, target: number) => {
    if (!target) return 0
    return Math.min((current / target) * 100, 100)
  }

  const getOverflow = (current: number, target: number) => {
    if (!target || current <= target) return 0
    return current - target
  }

  const caloriesTarget = client?.daily_calories || 2000
  const proteinsTarget = client?.daily_proteins || 100
  const fatsTarget = client?.daily_fats || 70
  const carbsTarget = client?.daily_carbs || 250

  return (
    <div className="flex flex-col h-full">
      {/* Date header */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-950 px-4 py-3 border-b border-gray-100 dark:border-gray-900">
        <div className="flex items-center justify-between">
          <button
            onClick={prevDay}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
          >
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {isToday ? 'Сегодня' : date.format('D MMMM')}
          </span>
          <button
            onClick={nextDay}
            className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700"
            disabled={isToday}
          >
            <ChevronRight
              size={20}
              className={isToday ? 'text-gray-300 dark:text-gray-700' : 'text-gray-600 dark:text-gray-400'}
            />
          </button>
        </div>
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="p-4 space-y-4">
          {/* Nutrition Summary */}
          {!summaryLoading && (
            <Card variant="elevated" className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Итого за день
              </h3>

              {/* Calories - main */}
              <div className="mb-4">
                <div className="flex items-end justify-between mb-1">
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {totals.calories}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      / {caloriesTarget} ккал
                    </span>
                  </span>
                  {getOverflow(totals.calories, caloriesTarget) > 0 && (
                    <span className="text-xs text-red-500 font-medium">
                      +{getOverflow(totals.calories, caloriesTarget)} ккал
                    </span>
                  )}
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${getProgress(totals.calories, caloriesTarget)}%` }}
                    className={`h-full rounded-full ${
                      totals.calories > caloriesTarget ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Macros grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* Proteins */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Белки</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {totals.proteins}/{proteinsTarget}г
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getProgress(totals.proteins, proteinsTarget)}%` }}
                      className={`h-full rounded-full ${
                        totals.proteins > proteinsTarget ? 'bg-red-400' : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Fats */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Жиры</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {totals.fats}/{fatsTarget}г
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getProgress(totals.fats, fatsTarget)}%` }}
                      className={`h-full rounded-full ${
                        totals.fats > fatsTarget ? 'bg-red-400' : 'bg-amber-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Carbs */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Углев.</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {totals.carbs}/{carbsTarget}г
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${getProgress(totals.carbs, carbsTarget)}%` }}
                      className={`h-full rounded-full ${
                        totals.carbs > carbsTarget ? 'bg-red-400' : 'bg-green-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Meals list */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Приёмы пищи
            </h3>

            {mealsLoading ? (
              <ListSkeleton count={3} />
            ) : !meals?.results?.length ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Нет записей за этот день
                </p>
              </div>
            ) : (
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={dateStr}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -50 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-2"
                >
                  {meals.results.map((meal: Meal) => (
                    <MealCard
                      key={meal.id}
                      meal={meal}
                      onDelete={handleMealDelete}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </PullToRefresh>
    </div>
  )
}

export default Diary
