import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import dayjs from 'dayjs'
import type { Meal } from '../../../types'

interface MealDetailModalProps {
  meal: Meal | null
  isOpen: boolean
  onClose: () => void
}

const dishTypeLabels: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
}

export function MealDetailModal({ meal, isOpen, onClose }: MealDetailModalProps) {
  if (!meal) return null

  const time = dayjs(meal.meal_time).format('HH:mm')
  const date = dayjs(meal.meal_time).format('D MMMM')
  const typeLabel = dishTypeLabels[meal.dish_type] || meal.dish_type

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-h-[90vh] bg-white dark:bg-gray-900 rounded-t-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 bg-black/20 dark:bg-white/20 rounded-full flex items-center justify-center z-10"
            >
              <X size={18} className="text-white" />
            </button>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-3rem)]">
              {/* Photo */}
              {meal.image ? (
                <img
                  src={meal.image}
                  alt={meal.dish_name}
                  className="w-full h-64 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <span className="text-6xl">
                    {meal.dish_type === 'breakfast' ? '🍳' :
                     meal.dish_type === 'lunch' ? '🍲' :
                     meal.dish_type === 'dinner' ? '🍽️' : '🍎'}
                  </span>
                </div>
              )}

              <div className="p-5 space-y-5">
                {/* Title and time */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {meal.dish_name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {typeLabel} · {time} · {date}
                  </p>
                </div>

                {/* KBJU Grid */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {meal.calories || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ккал</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">
                      {meal.proteins || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">белки</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {meal.fats || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">жиры</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {meal.carbohydrates || 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">углев.</p>
                  </div>
                </div>

                {/* Ingredients */}
                {meal.ingredients && meal.ingredients.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Состав
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {meal.ingredients.map((ingredient, index) => (
                        <span
                          key={index}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-700 dark:text-gray-300"
                        >
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Safe area padding */}
              <div className="h-8" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}
