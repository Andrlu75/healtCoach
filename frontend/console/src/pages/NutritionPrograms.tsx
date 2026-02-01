import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Copy, X, Trash2, CheckCircle, XCircle, ImageOff, Pencil } from 'lucide-react'
import { nutritionProgramsApi } from '../api/nutritionPrograms'
import { clientsApi } from '../api/clients'
import type { NutritionProgramListItem, Client, DetailedReport } from '../types'

interface CopyModalState {
  isOpen: boolean
  program: NutritionProgramListItem | null
}

interface DeleteModalState {
  isOpen: boolean
  program: NutritionProgramListItem | null
}

interface ReportModalState {
  isOpen: boolean
  programId: number | null
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Завтрак',
  snack1: 'Перекус 1',
  lunch: 'Обед',
  snack2: 'Перекус 2',
  dinner: 'Ужин',
}

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
  const [copyModal, setCopyModal] = useState<CopyModalState>({ isOpen: false, program: null })
  const [copyData, setCopyData] = useState({ client: '', start_date: '', name: '' })
  const [copying, setCopying] = useState(false)
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({ isOpen: false, program: null })
  const [deleting, setDeleting] = useState(false)
  const [reportModal, setReportModal] = useState<ReportModalState>({ isOpen: false, programId: null })
  const [reportData, setReportData] = useState<DetailedReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

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

  const openCopyModal = (e: React.MouseEvent, program: NutritionProgramListItem) => {
    e.stopPropagation()
    setCopyData({
      client: String(program.client),
      start_date: new Date().toISOString().split('T')[0],
      name: '',
    })
    setCopyModal({ isOpen: true, program })
  }

  const handleCopy = async () => {
    if (!copyModal.program || !copyData.start_date) return
    setCopying(true)
    try {
      const { data } = await nutritionProgramsApi.copy(copyModal.program.id, {
        client: copyData.client ? Number(copyData.client) : undefined,
        start_date: copyData.start_date,
        name: copyData.name || undefined,
      })
      setCopyModal({ isOpen: false, program: null })
      navigate(`/nutrition-programs/${data.id}`)
    } catch (err) {
      console.error('Failed to copy program:', err)
    } finally {
      setCopying(false)
    }
  }

  const openDeleteModal = (e: React.MouseEvent, program: NutritionProgramListItem) => {
    e.stopPropagation()
    setDeleteModal({ isOpen: true, program })
  }

  const handleDelete = async () => {
    if (!deleteModal.program) return
    setDeleting(true)
    try {
      await nutritionProgramsApi.delete(deleteModal.program.id)
      setDeleteModal({ isOpen: false, program: null })
      loadPrograms()
    } catch (err) {
      console.error('Failed to delete program:', err)
    } finally {
      setDeleting(false)
    }
  }

  const openReportModal = async (e: React.MouseEvent, programId: number) => {
    e.stopPropagation()
    setReportModal({ isOpen: true, programId })
    setReportLoading(true)
    try {
      const { data } = await nutritionProgramsApi.getDetailedReport(programId)
      setReportData(data)
    } catch (err) {
      console.error('Failed to load report:', err)
    } finally {
      setReportLoading(false)
    }
  }

  const closeReportModal = () => {
    setReportModal({ isOpen: false, programId: null })
    setReportData(null)
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
                onClick={(e) => openReportModal(e, program.id)}
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/nutrition-programs/${program.id}`)
                    }}
                    className="text-xs px-3 py-1.5 bg-primary/20 rounded-lg text-primary flex items-center gap-1"
                  >
                    <Pencil size={12} />
                    Редактировать
                  </button>
                  <button
                    onClick={(e) => openCopyModal(e, program)}
                    className="text-xs px-3 py-1.5 bg-secondary rounded-lg text-secondary-foreground flex items-center gap-1"
                  >
                    <Copy size={12} />
                    Копировать
                  </button>
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
                    onClick={(e) => openReportModal(e, program.id)}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/nutrition-programs/${program.id}`)
                          }}
                          className="text-xs px-2 py-1 bg-primary/20 rounded text-primary hover:bg-primary/30 flex items-center gap-1"
                          title="Редактировать"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => openCopyModal(e, program)}
                          className="text-xs px-2 py-1 bg-secondary rounded text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1"
                          title="Копировать программу"
                        >
                          <Copy size={12} />
                        </button>
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
                        <button
                          onClick={(e) => openDeleteModal(e, program)}
                          className="text-xs px-2 py-1 bg-red-500/20 rounded text-red-400 hover:bg-red-500/30"
                          title="Удалить программу"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Copy Modal */}
      {copyModal.isOpen && copyModal.program && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Копировать программу</h2>
              <button
                onClick={() => setCopyModal({ isOpen: false, program: null })}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Копирование: <span className="text-foreground">{copyModal.program.name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Клиент</label>
                <select
                  value={copyData.client}
                  onChange={(e) => setCopyData({ ...copyData, client: e.target.value })}
                  className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || c.telegram_username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Дата начала *
                </label>
                <input
                  type="date"
                  value={copyData.start_date}
                  onChange={(e) => setCopyData({ ...copyData, start_date: e.target.value })}
                  className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Название (опционально)
                </label>
                <input
                  type="text"
                  value={copyData.name}
                  onChange={(e) => setCopyData({ ...copyData, name: e.target.value })}
                  placeholder={`Копия: ${copyModal.program.name}`}
                  className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCopyModal({ isOpen: false, program: null })}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
              >
                Отмена
              </button>
              <button
                onClick={handleCopy}
                disabled={copying || !copyData.start_date}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {copying ? 'Копирование...' : 'Копировать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && deleteModal.program && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Удалить программу</h2>
              <button
                onClick={() => setDeleteModal({ isOpen: false, program: null })}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Вы уверены, что хотите удалить программу?
            </p>
            <p className="text-sm text-foreground font-medium mb-4">
              {deleteModal.program.name}
            </p>
            <p className="text-sm text-red-400 mb-4">
              Это действие нельзя отменить. Все данные программы будут удалены.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteModal({ isOpen: false, program: null })}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Report Modal */}
      {reportModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Подробный отчёт
                </h2>
                {reportData && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {reportData.program_name} • {reportData.client_name}
                  </p>
                )}
              </div>
              <button
                onClick={closeReportModal}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {reportLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Загрузка отчёта...
                </div>
              ) : reportData ? (
                <div className="space-y-6">
                  {reportData.days.map((day) => (
                    <div key={day.day_number} className="border border-border rounded-xl overflow-hidden">
                      {/* Day header */}
                      <div className="bg-muted px-4 py-3">
                        <h3 className="font-semibold text-foreground">
                          День {day.day_number}
                          {day.date && (
                            <span className="text-muted-foreground font-normal ml-2">
                              {new Date(day.date).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                              })}
                            </span>
                          )}
                        </h3>
                      </div>

                      {/* Meals table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-24">
                                Приём
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                                План
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                                Факт
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {day.meals.map((meal, mealIdx) => (
                              <tr
                                key={`${day.day_number}-${meal.type}-${mealIdx}`}
                                className="border-b border-border/50 last:border-0"
                              >
                                <td className="px-4 py-3 align-top">
                                  <div className="text-sm font-medium text-foreground">
                                    {MEAL_TYPE_LABELS[meal.type] || meal.type}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {meal.time}
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <div className="text-sm text-foreground font-medium">
                                    {meal.name}
                                  </div>
                                  {meal.description && (
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {meal.description}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  {meal.has_meal ? (
                                    <div className="space-y-2">
                                      {meal.actual_meals.map((actualMeal, mealItemIdx) => (
                                        <div
                                          key={actualMeal.id || mealItemIdx}
                                          className="flex items-start gap-3"
                                        >
                                          {/* Photo thumbnail */}
                                          {actualMeal.photo_url ? (
                                            <img
                                              src={actualMeal.photo_url}
                                              alt="Фото"
                                              className="w-16 h-16 object-cover rounded-lg shrink-0"
                                            />
                                          ) : (
                                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
                                              <ImageOff size={20} className="text-muted-foreground" />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            {/* Dish name and compliance */}
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-sm font-medium text-foreground">
                                                {actualMeal.dish_name}
                                              </span>
                                              {actualMeal.program_check_status && (
                                                actualMeal.is_compliant ? (
                                                  <CheckCircle size={14} className="text-green-400" />
                                                ) : (
                                                  <XCircle size={14} className="text-red-400" />
                                                )
                                              )}
                                            </div>
                                            {/* KBJU */}
                                            {actualMeal.calories && (
                                              <div className="text-xs text-muted-foreground">
                                                {Math.round(actualMeal.calories)} ккал
                                                {actualMeal.proteins && ` • Б: ${Math.round(actualMeal.proteins)}`}
                                                {actualMeal.fats && ` Ж: ${Math.round(actualMeal.fats)}`}
                                                {actualMeal.carbohydrates && ` У: ${Math.round(actualMeal.carbohydrates)}`}
                                              </div>
                                            )}
                                            {/* Ingredients */}
                                            {actualMeal.ingredients && actualMeal.ingredients.length > 0 && (
                                              <div className="text-xs text-muted-foreground mt-1">
                                                {actualMeal.ingredients
                                                  .slice(0, 5)
                                                  .map((ing) => (typeof ing === 'string' ? ing : ing.name))
                                                  .join(', ')}
                                                {actualMeal.ingredients.length > 5 && '...'}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <ImageOff size={16} />
                                      <span>Не отправлено</span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                  {reportData.days.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет данных по дням программы
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Не удалось загрузить отчёт
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 shrink-0">
              <button
                onClick={closeReportModal}
                className="w-full px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
