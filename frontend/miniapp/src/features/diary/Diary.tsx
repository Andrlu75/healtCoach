import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getMeals } from '../../api/endpoints'
import { useHaptic } from '../../shared/hooks'
import { ListSkeleton } from '../../shared/components/feedback'
import { PullToRefresh } from '../../shared/components/feedback/PullToRefresh'
import { MealCard } from '../meals/components/MealCard'
import type { Meal } from '../../types'

function Diary() {
  const [date, setDate] = useState(dayjs())
  const [direction, setDirection] = useState(0)
  const { selection, notification } = useHaptic()
  const queryClient = useQueryClient()

  const dateStr = date.format('YYYY-MM-DD')

  const { data: meals, isLoading, refetch } = useQuery({
    queryKey: ['meals', dateStr],
    queryFn: () => getMeals({ date: dateStr }).then((r) => r.data),
  })

  const prevDay = () => {
    selection()
    setDirection(-1)
    setDate((d) => d.subtract(1, 'day'))
  }

  const nextDay = () => {
    if (!date.isSame(dayjs(), 'day')) {
      selection()
      setDirection(1)
      setDate((d) => d.add(1, 'day'))
    }
  }

  const handleRefresh = useCallback(async () => {
    await refetch()
    notification('success')
  }, [refetch, notification])

  const handleMealDelete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['meals', dateStr] })
    queryClient.invalidateQueries({ queryKey: ['dailySummary'] })
  }, [queryClient, dateStr])

  const isToday = date.isSame(dayjs(), 'day')

  return (
    <div className="flex flex-col h-full">
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
        <div className="p-4">
          {isLoading ? (
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
      </PullToRefresh>
    </div>
  )
}

export default Diary
