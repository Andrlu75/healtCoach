import { useOptimistic, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff } from 'lucide-react'
import { getReminders, toggleReminder } from '../../api/endpoints'
import { useHaptic } from '../../shared/hooks'
import { Card } from '../../shared/components/ui'
import { ListSkeleton } from '../../shared/components/feedback'
import { cn } from '../../shared/lib/cn'
import type { Reminder } from '../../types'

const typeLabels: Record<string, string> = {
  meal: 'Приём пищи',
  water: 'Вода',
  supplement: 'Добавки',
  workout: 'Тренировка',
  custom: 'Другое',
}

const typeIcons: Record<string, string> = {
  meal: '🍽️',
  water: '💧',
  supplement: '💊',
  workout: '🏃',
  custom: '📌',
}

const frequencyLabels: Record<string, string> = {
  daily: 'Ежедневно',
  weekdays: 'Будни',
  custom: 'Выборочно',
}

function Reminders() {
  const queryClient = useQueryClient()
  const { impact, notification } = useHaptic()

  const { data: reminders, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => getReminders().then((r) => r.data?.results || r.data || []),
  })

  const [optimisticReminders, setOptimisticReminders] = useOptimistic(
    reminders || [],
    (state: Reminder[], { id, is_active }: { id: number; is_active: boolean }) =>
      state.map((r) => (r.id === id ? { ...r, is_active } : r))
  )

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      toggleReminder(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      notification('success')
    },
    onError: () => {
      notification('error')
    },
  })

  const handleToggle = useCallback(
    (reminder: Reminder) => {
      impact('light')
      const newState = !reminder.is_active
      setOptimisticReminders({ id: reminder.id, is_active: newState })
      toggleMutation.mutate({ id: reminder.id, is_active: newState })
    },
    [impact, setOptimisticReminders, toggleMutation]
  )

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Напоминания
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Управление уведомлениями
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : !optimisticReminders?.length ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Bell size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Напоминания не настроены
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {optimisticReminders.map((reminder: Reminder) => (
              <motion.div
                key={reminder.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
              >
                <Card
                  variant="elevated"
                  className={cn(
                    'p-4 transition-opacity',
                    !reminder.is_active && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg">
                      {typeIcons[reminder.reminder_type] || '📌'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {typeLabels[reminder.reminder_type] || reminder.reminder_type}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {reminder.time?.slice(0, 5)}
                        </span>
                      </div>
                      {reminder.message && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                          {reminder.message}
                        </p>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {frequencyLabels[reminder.frequency] || reminder.frequency}
                      </span>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleToggle(reminder)}
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                        reminder.is_active
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-gray-100 dark:bg-gray-800'
                      )}
                    >
                      {reminder.is_active ? (
                        <Bell size={18} className="text-blue-600" />
                      ) : (
                        <BellOff size={18} className="text-gray-400" />
                      )}
                    </motion.button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default Reminders
