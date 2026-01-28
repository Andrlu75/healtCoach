import { useEffect, useState } from 'react'
import { Users, UserCheck, UserPlus, UserX, DollarSign, User, Utensils, Dumbbell, X, Check, Clock, Play } from 'lucide-react'
import { settingsApi } from '../api/settings'
import { mealsApi, workoutsApi, type MealsDashboardResponse, type WorkoutsDashboardResponse } from '../api/data'
import type { DashboardStats, AIUsageResponse } from '../types'

const statCards = [
  { key: 'total_clients', label: 'Всего клиентов', icon: Users, color: 'blue' },
  { key: 'active_clients', label: 'Активные', icon: UserCheck, color: 'green' },
  { key: 'pending_clients', label: 'Ожидают', icon: UserPlus, color: 'yellow' },
  { key: 'paused_clients', label: 'На паузе', icon: UserX, color: 'gray' },
] as const

const colorMap = {
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  yellow: 'bg-yellow-500/20 text-yellow-400',
  gray: 'bg-secondary text-secondary-foreground',
}

const periodLabels: Record<string, string> = {
  today: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [usage, setUsage] = useState<AIUsageResponse | null>(null)
  const [mealsDashboard, setMealsDashboard] = useState<MealsDashboardResponse | null>(null)
  const [workoutsDashboard, setWorkoutsDashboard] = useState<WorkoutsDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCostsModal, setShowCostsModal] = useState(false)
  const [modalPeriod, setModalPeriod] = useState('month')
  const [modalUsage, setModalUsage] = useState<AIUsageResponse | null>(null)

  useEffect(() => {
    Promise.all([
      settingsApi.getDashboardStats(),
      mealsApi.dashboard(),
      workoutsApi.dashboard(),
      settingsApi.getUsageStats('month'),
    ])
      .then(([statsRes, mealsRes, workoutsRes, usageRes]) => {
        setStats(statsRes.data)
        setMealsDashboard(mealsRes.data)
        setWorkoutsDashboard(workoutsRes.data)
        setUsage(usageRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Load usage for modal when period changes
  useEffect(() => {
    if (showCostsModal) {
      settingsApi.getUsageStats(modalPeriod)
        .then(({ data }) => setModalUsage(data))
    }
  }, [showCostsModal, modalPeriod])

  const openCostsModal = () => {
    setModalUsage(usage)
    setModalPeriod('month')
    setShowCostsModal(true)
  }

  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Дашборд</h1>

      {/* Client stats + AI costs card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                <Icon size={20} />
              </div>
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {stats ? stats[key] : '—'}
            </p>
          </div>
        ))}

        {/* AI Costs Card */}
        <div
          onClick={openCostsModal}
          className="bg-card rounded-xl border border-border p-5 cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-colors"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
              <DollarSign size={20} />
            </div>
            <span className="text-sm text-muted-foreground">Затраты AI</span>
          </div>
          <p className="text-3xl font-bold text-foreground">
            ${usage ? Number(usage.total_cost_usd).toFixed(2) : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">с начала месяца</p>
        </div>
      </div>

      {/* Today's Meals by Client */}
      {mealsDashboard && mealsDashboard.clients.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
              <Utensils size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Питание за сегодня</h2>
              <p className="text-xs text-muted-foreground">{mealsDashboard.date}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="inline-flex gap-4 min-w-full pb-2">
              {mealsDashboard.clients.map(client => {
                const caloriesPercent = Math.round((client.totals.calories / client.norms.calories) * 100)
                return (
                <div key={client.client_id} className="w-64 flex-shrink-0 bg-muted rounded-lg p-3">
                  {/* Header with name and KBJU summary */}
                  <div className="mb-3">
                    <div className="font-medium text-foreground truncate">{client.client_name}</div>

                    {/* KBJU Summary - Main Accent */}
                    <div className="mt-2 p-2 bg-card rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg font-bold text-foreground">{client.totals.calories}</span>
                        <span className="text-sm text-muted-foreground">/ {client.norms.calories} ккал</span>
                      </div>
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full transition-all ${caloriesPercent >= 100 ? 'bg-green-500' : caloriesPercent >= 70 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                          style={{ width: `${Math.min(caloriesPercent, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className={client.totals.proteins >= client.norms.proteins ? 'text-green-400 font-medium' : 'text-muted-foreground'}>
                          Б: {client.totals.proteins}/{client.norms.proteins}
                        </span>
                        <span className={client.totals.fats >= client.norms.fats ? 'text-green-400 font-medium' : 'text-muted-foreground'}>
                          Ж: {client.totals.fats}/{client.norms.fats}
                        </span>
                        <span className={client.totals.carbs >= client.norms.carbs ? 'text-green-400 font-medium' : 'text-muted-foreground'}>
                          У: {client.totals.carbs}/{client.norms.carbs}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Meals list */}
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {client.meals.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Нет приёмов пищи</p>
                    ) : (
                      client.meals.map(meal => (
                        <div key={meal.id} className="flex items-center gap-2 bg-card rounded-lg p-2">
                          {meal.thumbnail && (
                            <img src={meal.thumbnail} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{meal.dish_name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {meal.meal_time} • {meal.calories} ккал
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Today's Workouts by Client */}
      {workoutsDashboard && workoutsDashboard.clients.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Dumbbell size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Тренировки на сегодня</h2>
              <p className="text-xs text-muted-foreground">{workoutsDashboard.date}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="inline-flex gap-4 min-w-full pb-2">
              {workoutsDashboard.clients.map(client => (
                <div key={client.client_id} className="w-64 flex-shrink-0 bg-muted rounded-lg p-3">
                  {/* Header with name and summary */}
                  <div className="mb-3">
                    <div className="font-medium text-foreground truncate">{client.client_name}</div>

                    {/* Summary */}
                    {client.workouts.length > 0 ? (
                      <div className="mt-2 p-2 bg-card rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-foreground">{client.summary.completed}/{client.summary.total}</span>
                          <span className="text-sm text-muted-foreground">выполнено</span>
                        </div>
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${client.summary.completed === client.summary.total && client.summary.total > 0 ? 'bg-green-500' : client.summary.completed > 0 ? 'bg-blue-500' : 'bg-gray-500'}`}
                            style={{ width: `${client.summary.total > 0 ? (client.summary.completed / client.summary.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 p-2 bg-card rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground text-center">Не назначено</p>
                      </div>
                    )}
                  </div>

                  {/* Workouts list */}
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {client.workouts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">На сегодня тренировок нет</p>
                    ) : (
                      client.workouts.map(workout => (
                        <div key={workout.id} className="flex items-center gap-2 bg-card rounded-lg p-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            workout.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            workout.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                            workout.status === 'skipped' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {workout.status === 'completed' ? <Check size={16} /> :
                             workout.status === 'in_progress' ? <Play size={16} /> :
                             <Clock size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{workout.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {workout.scheduled_time || '—'} • {workout.exercises_count} упр.
                              {workout.session && workout.status !== 'completed' && (
                                <span className="text-blue-400"> • {workout.session.completion_percentage}%</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Costs Modal */}
      {showCostsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCostsModal(false)}>
          <div className="bg-card rounded-xl border border-border w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <DollarSign size={20} />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Затраты AI</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {Object.entries(periodLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setModalPeriod(key)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        modalPeriod === key
                          ? 'bg-purple-500/20 text-purple-400 font-medium'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowCostsModal(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Total cost */}
              <div className="mb-5 p-4 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Общие затраты за период</span>
                <p className="text-2xl font-bold text-foreground mt-1">
                  ${modalUsage ? Number(modalUsage.total_cost_usd).toFixed(4) : '—'}
                </p>
              </div>

              {/* Breakdown by model table */}
              <h3 className="text-sm font-medium text-secondary-foreground mb-2">По моделям</h3>
              {modalUsage && modalUsage.stats.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border mb-6">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Провайдер</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Модель</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Тип</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Запросы</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Токены (in/out)</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Стоимость</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalUsage.stats.map((row, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-2 text-sm text-secondary-foreground">{row.provider}</td>
                          <td className="px-4 py-2 text-sm text-foreground font-medium">{row.model || '—'}</td>
                          <td className="px-4 py-2">
                            <span className="text-xs px-2 py-0.5 bg-secondary rounded text-secondary-foreground">
                              {row.task_type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-secondary-foreground">{row.requests_count}</td>
                          <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                            {(row.total_input_tokens || 0).toLocaleString()} / {(row.total_output_tokens || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-foreground">
                            ${Number(row.total_cost_usd || 0).toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4 mb-6">Нет данных за выбранный период</p>
              )}

              {/* Breakdown by client */}
              <div className="flex items-center gap-2 mb-2">
                <User size={16} className="text-muted-foreground" />
                <h3 className="text-sm font-medium text-secondary-foreground">По клиентам</h3>
              </div>
              {modalUsage && modalUsage.stats_by_client && modalUsage.stats_by_client.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Клиент</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Запросы</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Токены (in/out)</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Стоимость</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalUsage.stats_by_client.map((row, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-2 text-sm text-foreground font-medium">{row.client_name}</td>
                          <td className="px-4 py-2 text-sm text-right text-secondary-foreground">{row.requests_count}</td>
                          <td className="px-4 py-2 text-sm text-right text-muted-foreground">
                            {(row.total_input_tokens || 0).toLocaleString()} / {(row.total_output_tokens || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-foreground">
                            ${Number(row.total_cost_usd || 0).toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Нет данных по клиентам</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
