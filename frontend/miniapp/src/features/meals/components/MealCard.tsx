import { useState, useOptimistic, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { useMutation } from '@tanstack/react-query'
import { deleteMeal } from '../../../api/endpoints'
import { useHaptic, useSwipeGesture } from '../../../shared/hooks'
import { cn } from '../../../shared/lib/cn'
import { MealDetailModal } from './MealDetailModal'
import type { Meal } from '../../../types'

interface MealCardProps {
  meal: Meal
  onDelete?: () => void
  compact?: boolean
}

const dishTypeIcons: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🍲',
  dinner: '🍽️',
  snack: '🍎',
}

export function MealCard({ meal, onDelete, compact = false }: MealCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [optimisticDeleted, setOptimisticDeleted] = useOptimistic(false)
  const { impact, notification } = useHaptic()

  const deleteMutation = useMutation({
    mutationFn: () => deleteMeal(meal.id),
    onSuccess: () => {
      notification('success')
      onDelete?.()
    },
    onError: () => {
      setOptimisticDeleted(false)
      notification('error')
    },
  })

  const handleDelete = useCallback(async () => {
    impact('medium')
    setOptimisticDeleted(true)
    setIsDeleting(false)
    deleteMutation.mutate()
  }, [impact, deleteMutation, setOptimisticDeleted])

  const handleClick = () => {
    if (!isDeleting) {
      impact('light')
      setIsModalOpen(true)
    }
  }

  const { offsetX, handlers } = useSwipeGesture({
    threshold: 80,
    onSwipeLeft: () => {
      impact('light')
      setIsDeleting(true)
    },
  })

  if (optimisticDeleted) {
    return null
  }

  const time = dayjs(meal.meal_time).format('HH:mm')
  const icon = dishTypeIcons[meal.dish_type] || '🍽️'

  return (
    <>
      <AnimatePresence>
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -100 }}
          className="relative overflow-hidden rounded-xl"
        >
          <div
            className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center rounded-r-xl"
          >
            <Trash2 size={20} className="text-white" />
          </div>

          <motion.div
            {...handlers}
            onClick={handleClick}
            animate={{ x: isDeleting ? -80 : offsetX < 0 ? offsetX : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={cn(
              'relative bg-white dark:bg-gray-900 rounded-xl shadow-sm cursor-pointer',
              'flex items-center gap-3 touch-pan-y active:bg-gray-50 dark:active:bg-gray-800',
              compact ? 'p-2' : 'p-3'
            )}
          >
            {/* Thumbnail or icon */}
            {meal.image && !compact ? (
              <img
                src={meal.image}
                alt={meal.dish_name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className={cn(
                'rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center',
                compact ? 'w-8 h-8 text-base' : 'w-10 h-10 text-lg'
              )}>
                {icon}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'font-medium text-gray-900 dark:text-gray-100 truncate',
                  compact ? 'text-xs' : 'text-sm'
                )}>
                  {meal.dish_name}
                </span>
              </div>
              <div className={cn(
                'flex items-center gap-2 text-gray-400 dark:text-gray-500',
                compact ? 'text-[10px]' : 'text-xs'
              )}>
                <span>{time}</span>
                {!compact && meal.proteins != null && (
                  <>
                    <span>·</span>
                    <span>Б: {meal.proteins}г</span>
                  </>
                )}
                {!compact && meal.fats != null && (
                  <span>Ж: {meal.fats}г</span>
                )}
                {!compact && meal.carbohydrates != null && (
                  <span>У: {meal.carbohydrates}г</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Compliance status indicator */}
              {meal.compliance_status && (
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium',
                  meal.compliance_status.is_compliant
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                )}>
                  {meal.compliance_status.is_compliant ? '✓' : '!'}
                </div>
              )}
              <div className="text-right">
                <span className={cn(
                  'font-semibold text-gray-900 dark:text-gray-100',
                  compact ? 'text-xs' : 'text-sm'
                )}>
                  {meal.calories || 0}
                </span>
                <span className={cn(
                  'text-gray-400 dark:text-gray-500 ml-0.5',
                  compact ? 'text-[10px]' : 'text-xs'
                )}>
                  ккал
                </span>
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {isDeleting && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-end pr-4"
              >
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleDelete}
                  className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Trash2 size={20} className="text-white" />
                </motion.button>
                <button
                  onClick={() => setIsDeleting(false)}
                  className="absolute inset-0 -z-10"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      <MealDetailModal
        meal={meal}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
