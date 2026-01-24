import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getMeals } from '../api/endpoints'
import MealCard from '../components/MealCard'

export default function Diary() {
  const [date, setDate] = useState(dayjs())

  const { data: meals, isLoading } = useQuery({
    queryKey: ['meals', date.format('YYYY-MM-DD')],
    queryFn: () => getMeals({ date: date.format('YYYY-MM-DD') }).then((r) => r.data),
  })

  const prevDay = () => setDate((d) => d.subtract(1, 'day'))
  const nextDay = () => {
    if (!date.isSame(dayjs(), 'day')) {
      setDate((d) => d.add(1, 'day'))
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevDay} className="p-2">
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-medium">
          {date.isSame(dayjs(), 'day') ? 'Сегодня' : date.format('D MMMM')}
        </span>
        <button
          onClick={nextDay}
          className="p-2"
          disabled={date.isSame(dayjs(), 'day')}
        >
          <ChevronRight size={20} className={date.isSame(dayjs(), 'day') ? 'text-gray-300' : ''} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : !meals?.results?.length ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Нет записей за этот день
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {meals.results.map((meal: { id: number; dish_name: string; dish_type: string; calories: number | null; proteins: number | null; fats: number | null; carbohydrates: number | null; meal_time: string }) => (
            <MealCard key={meal.id} meal={meal} />
          ))}
        </div>
      )}
    </div>
  )
}
