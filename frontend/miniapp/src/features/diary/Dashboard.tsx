import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Droplets, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getDailySummary } from '../../api/endpoints'
import { useAuthStore } from '../auth'
import { useHaptic } from '../../shared/hooks'
import { Card } from '../../shared/components/ui'
import { NutritionSkeleton } from '../../shared/components/feedback'
import { NutritionProgress } from './components/NutritionProgress'
import { WaterProgress } from './components/WaterProgress'

function Dashboard() {
  const navigate = useNavigate()
  const client = useAuthStore((s) => s.client)
  const { impact } = useHaptic()

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dailySummary'],
    queryFn: () => getDailySummary().then((r) => r.data),
  })

  const totals = summary?.totals || { calories: 0, proteins: 0, fats: 0, carbs: 0 }

  const handleAddMeal = () => {
    impact('light')
    navigate('/diary/add')
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Привет, {client?.first_name || 'друг'}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Сегодняшний прогресс
        </p>
      </div>

      {isLoading ? (
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

      {summary?.meals_count != null && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Приёмов пищи сегодня: {summary.meals_count}
        </p>
      )}

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
