import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Calendar, Clock, MoreVertical, Copy, Trash2 } from 'lucide-react'
import { clientWorkoutsApi } from '../../api/workouts'
import { clientsApi } from '../../api/clients'
import type { ClientWorkout, Client } from '../../types'

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: 'Черновик', class: 'bg-gray-100 text-gray-700' },
  scheduled: { label: 'Запланирована', class: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'В процессе', class: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Завершена', class: 'bg-green-100 text-green-700' },
  skipped: { label: 'Пропущена', class: 'bg-red-100 text-red-700' },
}

const difficultyLabels: Record<string, string> = {
  beginner: 'Начинающий',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
}

export default function ClientWorkouts() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('client')

  const [workouts, setWorkouts] = useState<ClientWorkout[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<number | ''>(clientId ? Number(clientId) : '')
  const [statusFilter, setStatusFilter] = useState('')
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    loadWorkouts()
  }, [selectedClient, statusFilter])

  const loadClients = async () => {
    const { data } = await clientsApi.list({ status: 'active' })
    setClients(data.results || [])
  }

  const loadWorkouts = async () => {
    setLoading(true)
    try {
      const { data } = await clientWorkoutsApi.list({
        client: selectedClient || undefined,
        status: statusFilter || undefined,
      })
      setWorkouts(data.results || [])
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async (id: number) => {
    await clientWorkoutsApi.duplicate(id)
    loadWorkouts()
    setMenuOpen(null)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Удалить тренировку?')) {
      await clientWorkoutsApi.delete(id)
      loadWorkouts()
    }
    setMenuOpen(null)
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Не назначена'
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Тренировки клиентов</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/workouts/templates')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Шаблоны
          </button>
          <button
            onClick={() => {
              if (selectedClient) {
                navigate(`/workouts/new?client=${selectedClient}`)
              } else {
                navigate('/workouts/new')
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            Создать тренировку
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]"
        >
          <option value="">Все клиенты</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.full_name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="scheduled">Запланированные</option>
          <option value="in_progress">В процессе</option>
          <option value="completed">Завершённые</option>
          <option value="skipped">Пропущенные</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500">Загрузка...</div>
      ) : workouts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          <p className="mb-4">Тренировки не найдены</p>
          {selectedClient ? (
            <button
              onClick={() => navigate(`/workouts/new?client=${selectedClient}`)}
              className="text-blue-600 hover:text-blue-700"
            >
              Создать тренировку для клиента
            </button>
          ) : (
            <p className="text-sm">Выберите клиента, чтобы создать тренировку</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Тренировка</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Клиент</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Дата</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Статус</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Упражнений</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Прогресс</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Действия</th>
              </tr>
            </thead>
            <tbody>
              {workouts.map((workout) => (
                <tr
                  key={workout.id}
                  onClick={() => navigate(`/workouts/${workout.id}`)}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{workout.name}</div>
                    <div className="text-xs text-gray-500">
                      {difficultyLabels[workout.difficulty]}
                      {workout.estimated_duration && ` • ${workout.estimated_duration} мин`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{workout.client_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-gray-700">
                      <Calendar size={14} className="text-gray-400" />
                      {formatDate(workout.scheduled_date)}
                    </div>
                    {workout.scheduled_time && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={12} className="text-gray-400" />
                        {workout.scheduled_time.slice(0, 5)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        statusLabels[workout.status]?.class
                      }`}
                    >
                      {statusLabels[workout.status]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{workout.exercises_count}</td>
                  <td className="px-4 py-3">
                    {workout.last_session ? (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${workout.last_session.completion_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {workout.last_session.completion_percentage}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpen(menuOpen === workout.id ? null : workout.id)
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuOpen === workout.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDuplicate(workout.id)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Copy size={14} />
                            Дублировать
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(workout.id)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={14} />
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
