import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { deleteMeal } from '../../../api/endpoints'
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
  const [isLoaded, setIsLoaded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const queryClient = useQueryClient()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteMeal(meal.id)
      setIsFullscreen(false)
      // Invalidate meals and summary queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['dailySummary'] })
    } catch (error) {
      console.error('Error deleting meal:', error)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const typeLabel = dishTypeLabels[meal.dish_type] || 'Приём пищи'
  const icon = dishTypeIcons[meal.dish_type] || '🍽️'
  const time = dayjs(meal.meal_time).format('HH:mm')

  // Use thumbnail for preview if available, otherwise full image
  const thumbnailSrc = meal.thumbnail || meal.image

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
          <div className="flex-shrink-0 p-4 pt-12 bg-gradient-to-b from-black to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">{meal.dish_name}</p>
                <p className="text-white/70 text-sm">{typeLabel} · {time}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
                  className="w-10 h-10 bg-red-500/80 rounded-full flex items-center justify-center"
                >
                  <Trash2 size={18} className="text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsFullscreen(false) }}
                  className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Delete confirmation */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 flex items-center justify-center z-10"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false) }}
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  className="bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-white font-semibold text-lg mb-2">Удалить запись?</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Запись "{meal.dish_name}" будет удалена без возможности восстановления.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2.5 bg-gray-700 text-white rounded-xl font-medium"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50"
                    >
                      {isDeleting ? 'Удаление...' : 'Удалить'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Photo - centered with padding for header/footer */}
          <div className="flex-1 flex items-center justify-center px-4 py-2 min-h-0">
            {meal.image ? (
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                src={meal.image}
                alt={meal.dish_name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <span className="text-8xl">{icon}</span>
            )}
          </div>

          {/* Footer with nutrition */}
          <div className="flex-shrink-0 p-4 pb-10 bg-gradient-to-t from-black to-transparent">
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
        <div className="relative aspect-square rounded-xl overflow-hidden shadow-sm bg-gray-100 dark:bg-gray-800">
          {thumbnailSrc ? (
            <>
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">{icon}</span>
                </div>
              )}
              <img
                src={thumbnailSrc}
                alt={meal.dish_name}
                loading="lazy"
                onLoad={() => setIsLoaded(true)}
                className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
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
