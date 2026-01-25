import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Droplets, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getDailySummary, getMeals } from '../../api/endpoints'
import { useAuthStore } from '../auth'
import { useHaptic } from '../../shared/hooks'
import { Card } from '../../shared/components/ui'
import { NutritionSkeleton, ListSkeleton } from '../../shared/components/feedback'
import { NutritionProgress } from './components/NutritionProgress'
import { WaterProgress } from './components/WaterProgress'
import { MealCard } from '../meals/components/MealCard'
import type { Meal } from '../../types'

function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const client = useAuthStore((s) => s.client)
  const { impact } = useHaptic()

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dailySummary'],
    queryFn: () => getDailySummary().then((r) => r.data),
  })

  const { data: mealsData, isLoading: mealsLoading } = useQuery({
    queryKey: ['meals', 'today'],
    queryFn: () => getMeals().then((r) => r.data),
  })

  const totals = summary?.totals || { calories: 0, proteins: 0, fats: 0, carbs: 0 }
  const meals = mealsData?.results || []

  const handleAddMeal = () => {
    impact('light')
    navigate('/diary/add')
  }

  const handleMealDelete = () => {
    queryClient.invalidateQueries({ queryKey: ['meals'] })
    queryClient.invalidateQueries({ queryKey: ['dailySummary'] })
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Привет, {client?.first_name || 'друг'}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Сегодняшний прогресс
        </p>
      </div>

      {summaryLoading ? (
        <NutritionSkeleton />
      ) : (
        <Card variant="elevated" className="p-4">
          <div className="grid grid-cols-4 gap-2">
            <NutritionProgress
              label="Ккал"
              current={totals.calories}
              target={client?.daily_calories || 2000}
              unit="ккал"
              color="#3b82f6"
            />
            <NutritionProgress
              label="Белки"
              current={totals.proteins}
              target={client?.daily_proteins || 100}
              unit="г"
              color="#ef4444"
            />
            <NutritionProgress
              label="Жиры"
              current={totals.fats}
              target={client?.daily_fats || 70}
              unit="г"
              color="#f59e0b"
            />
            <NutritionProgress
              label="Углев."
              current={totals.carbs}
              target={client?.daily_carbs || 250}
              unit="г"
              color="#10b981"
            />
          </div>
        </Card>
      )}

      {client?.daily_water && (
        <Card variant="elevated" className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Droplets size={18} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Вода
            </span>
          </div>
          <WaterProgress
            current={summary?.water || 0}
            target={client.daily_water}
          />
        </Card>
      )}

      {/* Today's meals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Сегодня съедено
          </h2>
          {meals.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {meals.length} {meals.length === 1 ? 'приём' : meals.length < 5 ? 'приёма' : 'приёмов'}
            </span>
          )}
        </div>

        {mealsLoading ? (
          <ListSkeleton count={2} />
        ) : meals.length === 0 ? (
          <Card variant="elevated" className="p-6 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
              Пока нет записей
            </p>
            <button
              onClick={handleAddMeal}
              className="text-sm text-blue-600 dark:text-blue-400 font-medium"
            >
              Добавить приём пищи
            </button>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {meals.map((meal: Meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={handleMealDelete}
                compact
              />
            ))}
          </div>
        )}
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleAddMeal}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white"
      >
        <Plus size={24} />
      </motion.button>
    </div>
  )
}

export default Dashboard
