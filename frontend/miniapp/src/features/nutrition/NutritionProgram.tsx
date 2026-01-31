import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  getNutritionProgramToday,
  getNutritionProgramViolations,
} from '../../api/endpoints'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/components/ui'
import { Skeleton } from '../../shared/components/feedback'

function NutritionProgram() {
  const navigate = useNavigate()

  const { data: todayData, isLoading, isError, refetch } = useQuery({
    queryKey: ['nutritionProgramToday'],
    queryFn: async () => {
      const { data } = await getNutritionProgramToday()
      return data
    },
  })

  const { data: violationsData } = useQuery({
    queryKey: ['nutritionProgramViolations'],
    queryFn: async () => {
      const { data } = await getNutritionProgramViolations({ limit: 5 })
      return data
    },
    enabled: !!todayData?.has_program,
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
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
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
  const stats = todayData.today_stats

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {todayData.program_name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          День {todayData.day_number} из {todayData.total_days}
        </p>
      </div>

      {/* Progress card */}
      <Card variant="elevated">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Прогресс</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {progress}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-green-500 rounded-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Today stats */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Сегодня</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <span className="text-xl">🍽</span>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {stats.meals_count}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">Приёмов</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <span className="text-xl">✓</span>
              </div>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {stats.compliant_meals}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">В норме</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <span className="text-xl">!</span>
              </div>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">
                {stats.violations_count}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">Нарушений</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Рекомендации на сегодня</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayData.allowed_ingredients.length > 0 && (
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                <span>✓</span> Разрешённые продукты
              </p>
              <div className="flex flex-wrap gap-1.5">
                {todayData.allowed_ingredients.map((ing, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {todayData.forbidden_ingredients.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                <span>✕</span> Запрещённые продукты
              </p>
              <div className="flex flex-wrap gap-1.5">
                {todayData.forbidden_ingredients.map((ing, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {todayData.notes && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Заметки</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{todayData.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent violations */}
      {violationsData?.violations && violationsData.violations.length > 0 && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Последние нарушения</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {violationsData.violations.slice(0, 3).map((v) => (
              <div
                key={v.id}
                className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {v.meal_name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(v.meal_time).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {v.found_forbidden.map((ing, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 text-xs bg-red-200 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
                {v.ai_comment && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    {v.ai_comment}
                  </p>
                )}
              </div>
            ))}

            <button
              onClick={() => navigate('/nutrition/history')}
              className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              Смотреть всю историю →
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default NutritionProgram
