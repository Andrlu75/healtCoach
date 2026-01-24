import { useQuery } from '@tanstack/react-query'
import { getDailySummary } from '../api/endpoints'
import { useAuthStore } from '../stores/auth'
import NutritionProgress from '../components/NutritionProgress'

export default function Dashboard() {
  const client = useAuthStore((s) => s.client)

  const { data: summary } = useQuery({
    queryKey: ['dailySummary'],
    queryFn: () => getDailySummary().then((r) => r.data),
  })

  const totals = summary?.totals || { calories: 0, proteins: 0, fats: 0, carbs: 0 }

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-1">
        Привет, {client?.first_name || 'друг'}!
      </h1>
      <p className="text-sm text-gray-500 mb-4">Сегодняшний прогресс</p>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
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
      </div>

      {client?.daily_water && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Вода</span>
            <span className="text-xs text-gray-400">
              {summary?.water || 0} / {client.daily_water} л
            </span>
          </div>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all"
              style={{
                width: `${Math.min(((summary?.water || 0) / client.daily_water) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {summary?.meals_count != null && (
        <p className="text-xs text-gray-400 mt-3 text-center">
          Приёмов пищи сегодня: {summary.meals_count}
        </p>
      )}
    </div>
  )
}
