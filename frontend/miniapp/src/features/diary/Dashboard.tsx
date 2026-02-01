import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Droplets, Plus, Zap, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { getDailySummary, getMeals, getNutritionProgramSummary, getNutritionProgramToday } from '../../api/endpoints'
import { useAuthStore } from '../auth'
import { useHaptic } from '../../shared/hooks'
import { Card } from '../../shared/components/ui'
import { NutritionSkeleton } from '../../shared/components/feedback'
import { NutritionProgress } from './components/NutritionProgress'
import { WaterProgress } from './components/WaterProgress'
import { MealPhotoCard } from '../meals/components/MealPhotoCard'
import type { Meal } from '../../types'

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Завтрак',
  snack1: 'Перекус 1',
  lunch: 'Обед',
  snack2: 'Перекус 2',
  dinner: 'Ужин',
}

const MEAL_TYPE_ICONS: Record<string, string> = {
  breakfast: '🌅',
  snack1: '🍎',
  lunch: '🍽️',
  snack2: '🥜',
  dinner: '🌙',
}

function Dashboard() {
  const navigate = useNavigate()
  const client = useAuthStore((s) => s.client)
  const { impact } = useHaptic()
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [showMealTypeMenu, setShowMealTypeMenu] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null)

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dailySummary'],
    queryFn: () => getDailySummary().then((r) => r.data),
  })

  const today = dayjs().format('YYYY-MM-DD')

  const { data: mealsData, isLoading: mealsLoading } = useQuery({
    queryKey: ['meals', today],
    queryFn: () => getMeals({ date: today }).then((r) => r.data),
  })

  const { data: nutritionProgram } = useQuery({
    queryKey: ['nutritionProgramSummary'],
    queryFn: () => getNutritionProgramSummary().then((r) => r.data),
  })

  // Загружаем данные программы на сегодня для получения списка приёмов пищи
  const { data: nutritionProgramToday } = useQuery({
    queryKey: ['nutritionProgramToday'],
    queryFn: () => getNutritionProgramToday().then((r) => r.data),
    enabled: !!nutritionProgram?.has_program && nutritionProgram?.status === 'active',
  })

  // Получаем список приёмов пищи из программы (с описаниями)
  const programMeals = nutritionProgramToday?.meals || []
  const hasActiveProgram = nutritionProgram?.has_program && nutritionProgram?.status === 'active'

  const totals = summary?.totals || { calories: 0, proteins: 0, fats: 0, carbs: 0 }
  const meals = mealsData?.results || []

  const handleAddMeal = () => {
    impact('light')
    // Если есть активная программа — сначала выбираем тип приёма пищи
    if (hasActiveProgram && programMeals.length > 0) {
      setShowMealTypeMenu(true)
      return
    }
    // Иначе стандартный флоу выбора режима
    proceedWithModeSelection()
  }

  const proceedWithModeSelection = (mealType?: string) => {
    const params = mealType ? `?programMealType=${mealType}` : ''
    // Если режим выбран в настройках - сразу переходим
    if (client?.meal_analysis_mode === 'fast') {
      navigate(`/diary/add${params}`)
      return
    }
    if (client?.meal_analysis_mode === 'smart') {
      navigate(`/diary/add-smart${params}`)
      return
    }
    // Иначе показываем меню выбора режима
    setSelectedMealType(mealType || null)
    setShowModeMenu(true)
  }

  const handleSelectMealType = (mealType: string) => {
    impact('light')
    setShowMealTypeMenu(false)
    proceedWithModeSelection(mealType)
  }

  const handleSelectMode = (mode: 'fast' | 'smart') => {
    impact('light')
    setShowModeMenu(false)
    const params = selectedMealType ? `?programMealType=${selectedMealType}` : ''
    navigate(mode === 'smart' ? `/diary/add-smart${params}` : `/diary/add${params}`)
    setSelectedMealType(null)
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Greeting */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Привет, {client?.first_name}!
        </h1>
      </div>

      {/* Nutrition progress */}
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

      {/* Water progress */}
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

      {/* Nutrition program widget */}
      {nutritionProgram?.has_program && nutritionProgram.status === 'active' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            variant="elevated"
            className="p-4 cursor-pointer"
            onClick={() => navigate('/nutrition')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🥗</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Программа питания
                </span>
              </div>
              {nutritionProgram.compliance_rate !== null && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  nutritionProgram.compliance_rate >= 80
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : nutritionProgram.compliance_rate >= 50
                      ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {nutritionProgram.compliance_rate}%
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                {nutritionProgram.name}
              </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                День {nutritionProgram.current_day || 1} / {nutritionProgram.total_days}
              </span>
            </div>

            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${((nutritionProgram.current_day || 1) / nutritionProgram.total_days) * 100}%`,
                }}
                className="h-full bg-green-500 rounded-full"
              />
            </div>
          </Card>
        </motion.div>
      )}

      {/* Meals photo thumbnails */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Сегодня
        </h2>
        {mealsLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-square rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : meals.length === 0 ? (
          <Card variant="elevated" className="p-6 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-2">
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
          <div className="grid grid-cols-3 gap-2">
            {meals.map((meal: Meal) => (
              <MealPhotoCard key={meal.id} meal={meal} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleAddMeal}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white z-40"
      >
        <Plus size={24} />
      </motion.button>

      {/* Meal type selection overlay (for nutrition program) */}
      <AnimatePresence>
        {showMealTypeMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMealTypeMenu(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl p-4 pb-8 z-50 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Выберите приём пищи
                </h3>
                <button
                  onClick={() => setShowMealTypeMenu(false)}
                  className="p-2 text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {programMeals.map((meal: { type: string; time: string; name: string; description: string }) => (
                  <motion.button
                    key={meal.type}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectMealType(meal.type)}
                    className="w-full flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-left"
                  >
                    <span className="text-2xl mt-0.5">{MEAL_TYPE_ICONS[meal.type] || '🍽️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {meal.name || MEAL_TYPE_LABELS[meal.type] || meal.type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {meal.time}
                        </span>
                      </div>
                      {meal.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {meal.description}
                        </p>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mode selection overlay */}
      <AnimatePresence>
        {showModeMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowModeMenu(false); setSelectedMealType(null) }}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl p-4 pb-8 z-50"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {selectedMealType
                    ? `${MEAL_TYPE_LABELS[selectedMealType] || selectedMealType} — выберите режим`
                    : 'Добавить приём пищи'
                  }
                </h3>
                <button
                  onClick={() => { setShowModeMenu(false); setSelectedMealType(null) }}
                  className="p-2 text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {/* Быстрый режим */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectMode('fast')}
                  className="w-full flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-left"
                >
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <Zap size={24} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      Быстрый режим
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Распознавание + сохранение сразу
                    </div>
                  </div>
                </motion.button>

                {/* Умный режим */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectMode('smart')}
                  className="w-full flex items-start gap-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl text-left border-2 border-purple-200 dark:border-purple-800"
                >
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                    <Sparkles size={24} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        Умный режим
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded">
                        NEW
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Детальный анализ ингредиентов с возможностью редактирования
                    </div>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Dashboard
