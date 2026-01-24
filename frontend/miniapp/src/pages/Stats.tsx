import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { getMeals } from '../api/endpoints'
import WeekChart from '../components/WeekChart'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export default function Stats() {
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
          days.push({ date: dateStr, label: WEEKDAYS[i], calories })
        } catch {
          days.push({ date: dateStr, label: WEEKDAYS[i], calories: 0 })
        }
      }
      return days
    },
  })

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-1">Статистика</h2>
      <p className="text-sm text-gray-500 mb-4">Калории за неделю</p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-3 shadow-sm">
          <WeekChart data={weekData || []} />
        </div>
      )}

      {weekData && (
        <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Среднее за день</span>
            <span className="font-medium">
              {Math.round(
                weekData.reduce((s, d) => s + d.calories, 0) /
                  Math.max(weekData.filter((d) => d.calories > 0).length, 1)
              )}{' '}
              ккал
            </span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-500">Всего за неделю</span>
            <span className="font-medium">
              {weekData.reduce((s, d) => s + d.calories, 0)} ккал
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
