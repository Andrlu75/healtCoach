import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import dayjs from 'dayjs'
import type { Meal } from '../../../types'

interface MealPhotoCardProps {
  meal: Meal
}

const dishTypeLabels: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
}

const dishTypeIcons: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🍲',
  dinner: '🍽️',
  snack: '🍎',
}

export function MealPhotoCard({ meal }: MealPhotoCardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const typeLabel = dishTypeLabels[meal.dish_type] || 'Приём пищи'
  const icon = dishTypeIcons[meal.dish_type] || '🍽️'
  const time = dayjs(meal.meal_time).format('HH:mm')

  const fullscreenModal = (
    <AnimatePresence>
      {isFullscreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">{meal.dish_name}</p>
                <p className="text-white/70 text-sm">{typeLabel} · {time}</p>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          {/* Photo */}
          <div className="flex-1 flex items-center justify-center">
            {meal.image ? (
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                src={meal.image}
                alt={meal.dish_name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-8xl">{icon}</span>
            )}
          </div>

          {/* Footer with nutrition */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-black/80 to-transparent">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-white font-bold text-lg">{meal.calories || 0}</p>
                <p className="text-white/60 text-xs">ккал</p>
              </div>
              <div>
                <p className="text-white font-bold text-lg">{meal.proteins || 0}г</p>
                <p className="text-white/60 text-xs">белки</p>
              </div>
              <div>
                <p className="text-white font-bold text-lg">{meal.fats || 0}г</p>
                <p className="text-white/60 text-xs">жиры</p>
              </div>
              <div>
                <p className="text-white font-bold text-lg">{meal.carbohydrates || 0}г</p>
                <p className="text-white/60 text-xs">углев.</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsFullscreen(true)}
        className="cursor-pointer"
      >
        {/* Photo thumbnail */}
        <div className="relative aspect-square rounded-xl overflow-hidden shadow-sm">
          {meal.image ? (
            <img
              src={meal.image}
              alt={meal.dish_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <span className="text-2xl">{icon}</span>
            </div>
          )}
        </div>

        {/* Text below photo */}
        <div className="mt-1 px-0.5">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{typeLabel}</p>
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate leading-tight">
            {meal.dish_name}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">{meal.calories || 0} ккал</p>
        </div>
      </motion.div>

      {createPortal(fullscreenModal, document.body)}
    </>
  )
}
