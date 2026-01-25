import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion, AnimatePresence } from 'framer-motion'
import { getMeals } from '../../api/endpoints'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/components/ui'
import { Skeleton } from '../../shared/components/feedback'
import { cn } from '../../shared/lib/cn'
import { WeekChart } from './components/WeekChart'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
type Period = 'week' | 'month'

function Stats() {
  const [period, setPeriod] = useState<Period>('week')
  const weekStart = dayjs().startOf('week')

  const { data: weekData, isLoading } = useQuery({
    queryKey: ['weekStats', weekStart.format('YYYY-MM-DD')],
    queryFn: async () => {
      const days = []
      for (let i = 0; i < 7; i++) {
        const d = weekStart.add(i, 'day')
        const dateStr = d.format('YYYY-MM-DD')
        try {
          const { data } = await getMeals({ date: dateStr })
          const meals = data.results || []
          const calories = meals.reduce(
            (sum: number, m: { calories: number | null }) => sum + (m.calories || 0),
            0
          )
          const proteins = meals.reduce(
            (sum: number, m: { proteins: number | null }) => sum + (m.proteins || 0),
            0
          )
          const fats = meals.reduce(
            (sum: number, m: { fats: number | null }) => sum + (m.fats || 0),
            0
          )
          const carbs = meals.reduce(
            (sum: number, m: { carbohydrates: number | null }) => sum + (m.carbohydrates || 0),
            0
          )
          days.push({ date: dateStr, label: WEEKDAYS[i], calories, proteins, fats, carbs })
        } catch {
          days.push({ date: dateStr, label: WEEKDAYS[i], calories: 0, proteins: 0, fats: 0, carbs: 0 })
        }
      }
      return days
    },
  })

  const avgCalories = weekData
    ? Math.round(
        weekData.reduce((s, d) => s + d.calories, 0) /
          Math.max(weekData.filter((d) => d.calories > 0).length, 1)
      )
    : 0

  const totalCalories = weekData
    ? weekData.reduce((s, d) => s + d.calories, 0)
    : 0

  const totalProteins = weekData
    ? weekData.reduce((s, d) => s + d.proteins, 0)
    : 0

  const totalFats = weekData
    ? weekData.reduce((s, d) => s + d.fats, 0)
    : 0

  const totalCarbs = weekData
    ? weekData.reduce((s, d) => s + d.carbs, 0)
    : 0

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Статистика
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Анализ питания
        </p>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {(['week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
              period === p
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {p === 'week' ? 'Неделя' : 'Месяц'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={period}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-4"
        >
          {isLoading ? (
            <Card variant="elevated" className="p-4">
              <Skeleton className="h-48 w-full" />
            </Card>
          ) : (
            <Card variant="elevated" className="p-4">
              <WeekChart data={weekData || []} />
            </Card>
          )}

          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Итоги за неделю</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Среднее за день
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {avgCalories} ккал
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Всего калорий
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {totalCalories} ккал
                </span>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Макронутриенты</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <span className="text-red-600 font-semibold text-sm">Б</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {totalProteins}г
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Белки</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                    <span className="text-amber-600 font-semibold text-sm">Ж</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {totalFats}г
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Жиры</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <span className="text-green-600 font-semibold text-sm">У</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {totalCarbs}г
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Углеводы</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default Stats
