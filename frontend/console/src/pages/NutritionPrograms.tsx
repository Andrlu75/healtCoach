import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus } from 'lucide-react'
import { nutritionProgramsApi } from '../api/nutritionPrograms'
import { clientsApi } from '../api/clients'
import type { NutritionProgramListItem, Client } from '../types'

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: 'Черновик', class: 'bg-secondary text-secondary-foreground' },
  active: { label: 'Активна', class: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Завершена', class: 'bg-blue-500/20 text-blue-400' },
  cancelled: { label: 'Отменена', class: 'bg-red-500/20 text-red-400' },
}

export default function NutritionPrograms() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<NutritionProgramListItem[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    clientsApi.list({ status: 'active' }).then(({ data }) => {
      setClients(data.results || [])
    })
  }, [])

  useEffect(() => {
    loadPrograms()
  }, [statusFilter, clientFilter])

  const loadPrograms = () => {
    setLoading(true)
    nutritionProgramsApi
      .list({
        status: statusFilter || undefined,
        client: clientFilter ? Number(clientFilter) : undefined,
        search: search || undefined,
      })
      .then(({ data }) => setPrograms(data.results || []))
      .finally(() => setLoading(false))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadPrograms()
  }

  const handleAction = async (
    e: React.MouseEvent,
    id: number,
    action: 'activate' | 'cancel' | 'complete'
  ) => {
    e.stopPropagation()
    await nutritionProgramsApi[action](id)
    loadPrograms()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Программы питания</h1>
        <button
          onClick={() => navigate('/nutrition-programs/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Создать программу</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="w-full pl-9 pr-3 py-2 bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none placeholder:text-muted-foreground"
          />
        </form>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-3 py-2 bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="">Все клиенты</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || c.telegram_username}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="active">Активные</option>
          <option value="completed">Завершённые</option>
          <option value="cancelled">Отменённые</option>
        </select>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : programs.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Программы питания не найдены
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {programs.map((program) => (
              <div
                key={program.id}
                onClick={() => navigate(`/nutrition-programs/${program.id}`)}
                className="bg-card rounded-xl border border-border p-4 cursor-pointer active:bg-muted"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-foreground">{program.name}</div>
                    <div className="text-sm text-muted-foreground">{program.client_name}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabels[program.status]?.class}`}
                  >
                    {statusLabels[program.status]?.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                  <span>
                    {formatDate(program.start_date)} - {formatDate(program.end_date)}
                  </span>
                  <span>{program.duration_days} дней</span>
                  {program.current_day && (
                    <span>День {program.current_day}</span>
                  )}
                </div>
                {program.compliance_rate !== null && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Соблюдение</span>
                      <span className="text-foreground">{program.compliance_rate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${program.compliance_rate >= 80 ? 'bg-green-500' : program.compliance_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${program.compliance_rate}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2 border-t border-border">
                  {program.status === 'draft' && (
                    <button
                      onClick={(e) => handleAction(e, program.id, 'activate')}
                      className="text-xs px-3 py-1.5 bg-green-500/20 rounded-lg text-green-400"
                    >
                      Активировать
                    </button>
                  )}
                  {program.status === 'active' && (
                    <>
                      <button
                        onClick={(e) => handleAction(e, program.id, 'complete')}
                        className="text-xs px-3 py-1.5 bg-blue-500/20 rounded-lg text-blue-400"
                      >
                        Завершить
                      </button>
                      <button
                        onClick={(e) => handleAction(e, program.id, 'cancel')}
                        className="text-xs px-3 py-1.5 bg-red-500/20 rounded-lg text-red-400"
                      >
                        Отменить
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                    Клиент
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                    Название
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                    Период
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                    Дней
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                    Статус
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                    Соблюдение
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {programs.map((program) => (
                  <tr
                    key={program.id}
                    onClick={() => navigate(`/nutrition-programs/${program.id}`)}
                    className="border-b border-border/50 hover:bg-muted cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {program.client_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{program.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(program.start_date)} - {formatDate(program.end_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-muted-foreground">
                      {program.current_day ? (
                        <span>
                          {program.current_day}/{program.duration_days}
                        </span>
                      ) : (
                        program.duration_days
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabels[program.status]?.class}`}
                      >
                        {statusLabels[program.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {program.compliance_rate !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${program.compliance_rate >= 80 ? 'bg-green-500' : program.compliance_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${program.compliance_rate}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {program.compliance_rate}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className="flex justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {program.status === 'draft' && (
                          <button
                            onClick={(e) => handleAction(e, program.id, 'activate')}
                            className="text-xs px-2 py-1 bg-green-500/20 rounded text-green-400 hover:bg-green-500/30"
                          >
                            Активировать
                          </button>
                        )}
                        {program.status === 'active' && (
                          <>
                            <button
                              onClick={(e) => handleAction(e, program.id, 'complete')}
                              className="text-xs px-2 py-1 bg-blue-500/20 rounded text-blue-400 hover:bg-blue-500/30"
                            >
                              Завершить
                            </button>
                            <button
                              onClick={(e) => handleAction(e, program.id, 'cancel')}
                              className="text-xs px-2 py-1 bg-red-500/20 rounded text-red-400 hover:bg-red-500/30"
                            >
                              Отменить
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
