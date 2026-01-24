import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff } from 'lucide-react'
import { getReminders, toggleReminder } from '../api/endpoints'

interface Reminder {
  id: number
  reminder_type: string
  message: string
  time: string
  frequency: string
  is_active: boolean
}

const typeLabels: Record<string, string> = {
  meal: 'Приём пищи',
  water: 'Вода',
  supplement: 'Добавки',
  workout: 'Тренировка',
  custom: 'Другое',
}

const frequencyLabels: Record<string, string> = {
  daily: 'Ежедневно',
  weekdays: 'Будни',
  custom: 'Выборочно',
}

export default function Reminders() {
  const queryClient = useQueryClient()

  const { data: reminders, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => getReminders().then((r) => r.data?.results || r.data || []),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      toggleReminder(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
  })

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Напоминания</h2>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : !reminders?.length ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Напоминания не настроены
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {reminders.map((r: Reminder) => (
            <div
              key={r.id}
              className={`bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 ${
                !r.is_active ? 'opacity-50' : ''
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {typeLabels[r.reminder_type] || r.reminder_type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {r.time?.slice(0, 5)}
                  </span>
                </div>
                {r.message && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {r.message}
                  </p>
                )}
                <span className="text-xs text-gray-400">
                  {frequencyLabels[r.frequency] || r.frequency}
                </span>
              </div>

              <button
                onClick={() => toggleMutation.mutate({ id: r.id, is_active: !r.is_active })}
                className="p-2 rounded-lg hover:bg-gray-50"
              >
                {r.is_active ? (
                  <Bell size={18} className="text-blue-600" />
                ) : (
                  <BellOff size={18} className="text-gray-400" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
