import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, ChevronDown } from 'lucide-react'
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
  const [showDetails, setShowDetails] = useState(false)
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

  const detailedIngredients = meal.health_analysis?.detailed_ingredients
  const estimatedWeight = meal.health_analysis?.estimated_weight
  const simpleIngredients = meal.ingredients
  const hasDetails = (detailedIngredients && detailedIngredients.length > 0) || (simpleIngredients && simpleIngredients.length > 0)

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
              <button
                onClick={(e) => { e.stopPropagation(); setIsFullscreen(false) }}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
              >
                <X size={20} className="text-white" />
              </button>
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

          {/* Compliance status banner */}
          {meal.compliance_status && !meal.compliance_status.is_compliant && (
            <div className="flex-shrink-0 mx-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-red-400 font-medium text-sm">⚠️ Нарушение программы</span>
              </div>
              {meal.compliance_status.found_forbidden.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {meal.compliance_status.found_forbidden.map((ing, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded">
                      {ing}
                    </span>
                  ))}
                </div>
              )}
              {meal.compliance_status.ai_comment && (
                <p className="text-white/70 text-xs">{meal.compliance_status.ai_comment}</p>
              )}
            </div>
          )}

          {/* Details button + expandable panel */}
          {hasDetails && (
            <div className="flex-shrink-0 px-4">
              <button
                onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails) }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-white/60 text-sm"
              >
                <span>{showDetails ? 'Скрыть' : 'Подробнее'}</span>
                <motion.span
                  animate={{ rotate: showDetails ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={16} />
                </motion.span>
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-white/10 rounded-xl p-3 mb-2 max-h-[40vh] overflow-y-auto">
                      {estimatedWeight && (
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                          <span className="text-white/50 text-xs">Вес порции</span>
                          <span className="text-white font-medium text-sm">~{estimatedWeight} г</span>
                        </div>
                      )}

                      {detailedIngredients && detailedIngredients.length > 0 ? (
                        <div className="space-y-2">
                          {detailedIngredients.map((ing, i) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm truncate">{ing.name}</p>
                                <p className="text-white/40 text-xs">{ing.weight} г</p>
                              </div>
                              <div className="flex gap-2 text-xs flex-shrink-0">
                                <span className="text-blue-400">{ing.calories}</span>
                                <span className="text-red-400">{ing.proteins}б</span>
                                <span className="text-amber-400">{ing.fats}ж</span>
                                <span className="text-green-400">{ing.carbs}у</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : simpleIngredients && simpleIngredients.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-white/50 text-xs mb-2">Ингредиенты</p>
                          {simpleIngredients.map((ing, i) => (
                            <p key={i} className="text-white text-sm">• {ing}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Footer with nutrition + delete */}
          <div className="flex-shrink-0 p-4 pb-10 bg-gradient-to-t from-black to-transparent">
            <div className="flex items-end gap-3">
              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
                className="flex-shrink-0 w-[52px] h-[52px] bg-white/10 rounded-xl flex items-center justify-center"
              >
                <Trash2 size={20} className="text-white/40" />
              </button>

              {/* KBJU cards */}
              <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                <div className="bg-blue-500/20 rounded-xl p-2.5">
                  <p className="text-blue-400 font-bold text-base">{meal.calories || 0}</p>
                  <p className="text-white/50 text-xs">ккал</p>
                </div>
                <div className="bg-red-500/20 rounded-xl p-2.5">
                  <p className="text-red-400 font-bold text-base">{meal.proteins || 0}г</p>
                  <p className="text-white/50 text-xs">белки</p>
                </div>
                <div className="bg-amber-500/20 rounded-xl p-2.5">
                  <p className="text-amber-400 font-bold text-base">{meal.fats || 0}г</p>
                  <p className="text-white/50 text-xs">жиры</p>
                </div>
                <div className="bg-green-500/20 rounded-xl p-2.5">
                  <p className="text-green-400 font-bold text-base">{meal.carbohydrates || 0}г</p>
                  <p className="text-white/50 text-xs">углев.</p>
                </div>
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
          {/* Compliance status indicator */}
          {meal.compliance_status && (
            <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
              meal.compliance_status.is_compliant
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}>
              {meal.compliance_status.is_compliant ? '✓' : '!'}
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
