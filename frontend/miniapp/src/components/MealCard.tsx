import dayjs from 'dayjs'

interface MealData {
  id: number
  dish_name: string
  dish_type: string
  calories: number | null
  proteins: number | null
  fats: number | null
  carbohydrates: number | null
  meal_time: string
}

const dishTypeLabels: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
}

export default function MealCard({ meal }: { meal: MealData }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <div className="flex justify-between items-start mb-1">
        <span className="text-sm font-medium">
          {dishTypeLabels[meal.dish_type] || meal.dish_type || 'Приём пищи'}
        </span>
        <span className="text-xs text-gray-400">
          {dayjs(meal.meal_time).format('HH:mm')}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-2 line-clamp-2">{meal.dish_name}</p>
      {meal.calories != null && (
        <div className="flex gap-3 text-xs text-gray-500">
          <span>{Math.round(meal.calories)} ккал</span>
          {meal.proteins != null && <span>Б: {Math.round(meal.proteins)}г</span>}
          {meal.fats != null && <span>Ж: {Math.round(meal.fats)}г</span>}
          {meal.carbohydrates != null && <span>У: {Math.round(meal.carbohydrates)}г</span>}
        </div>
      )}
    </div>
  )
}
