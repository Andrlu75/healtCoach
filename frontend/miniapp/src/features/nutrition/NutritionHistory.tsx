import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getNutritionProgramHistory } from '../../api/endpoints'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/components/ui'
import { Skeleton } from '../../shared/components/feedback'
import { cn } from '../../shared/lib/cn'

function NutritionHistory() {
  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['nutritionProgramHistory'],
    queryFn: async () => {
      const { data } = await getNutritionProgramHistory()
      return data
    },
  })

  if (isError) {
    return (
      <div className="p-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"
        >
          ← Назад
        </button>
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
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!data?.has_program) {
    return (
      <div className="p-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"
        >
          ← Назад
        </button>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-3xl">📊</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Нет данных
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            История появится когда программа будет активна
          </p>
        </div>
      </div>
    )
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    active: { label: 'Активна', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
    completed: { label: 'Завершена', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    cancelled: { label: 'Отменена', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  }

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"
      >
        ← Назад
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {data.program_name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(data.start_date).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'short',
            })} — {new Date(data.end_date).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'short',
            })}
          </p>
        </div>
        <span className={cn('px-2 py-1 text-xs rounded-full', statusLabels[data.status]?.color)}>
          {statusLabels[data.status]?.label}
        </span>
      </div>

      {/* Summary card */}
      <Card variant="elevated">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Прогресс</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {data.days.length} / {data.total_days}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">дней</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Соблюдение</p>
              <p className={cn(
                'text-xl font-bold',
                data.compliance_rate !== null
                  ? data.compliance_rate >= 80
                    ? 'text-green-600 dark:text-green-400'
                    : data.compliance_rate >= 50
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  : 'text-gray-500'
              )}>
                {data.compliance_rate !== null ? `${data.compliance_rate}%` : '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">за программу</p>
            </div>
          </div>

          {data.compliance_rate !== null && (
            <div className="mt-3">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${data.compliance_rate}%` }}
                  className={cn(
                    'h-full rounded-full',
                    data.compliance_rate >= 80
                      ? 'bg-green-500'
                      : data.compliance_rate >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  )}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Days list */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>По дням</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.days.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Пока нет данных
              </div>
            ) : (
              data.days.map((day) => {
                const dayCompliance = day.meals_count > 0
                  ? Math.round((day.compliant_meals / day.meals_count) * 100)
                  : null

                return (
                  <div
                    key={day.day_number}
                    className="p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          День {day.day_number}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(day.date).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {day.meals_count} приёмов
                        </span>
                        {dayCompliance !== null && (
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            dayCompliance >= 80
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : dayCompliance >= 50
                                ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                          )}>
                            {dayCompliance}%
                          </span>
                        )}
                      </div>
                    </div>

                    {day.violations.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {day.violations.map((v, i) => (
                          <div
                            key={i}
                            className="p-2 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/20"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {v.meal_name}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(v.meal_time).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {v.found_forbidden.map((ing, j) => (
                                <span
                                  key={j}
                                  className="px-1.5 py-0.5 text-xs bg-red-200 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded"
                                >
                                  {ing}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default NutritionHistory
