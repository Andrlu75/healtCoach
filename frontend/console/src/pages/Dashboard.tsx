import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Utensils, Dumbbell, X, Check, Clock, Play, MessageSquare, Loader2, Timer } from 'lucide-react'
import { mealsApi, workoutsApi, chatApi, type MealsDashboardResponse, type WorkoutsDashboardResponse, type MealDashboardItem, type WorkoutDashboardItem, type WorkoutSessionReport } from '../api/data'

export default function Dashboard() {
  const [mealsDashboard, setMealsDashboard] = useState<MealsDashboardResponse | null>(null)
  const [workoutsDashboard, setWorkoutsDashboard] = useState<WorkoutsDashboardResponse | null>(null)
  const [unreadByClient, setUnreadByClient] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  // Модальное окно с деталями блюда
  const [selectedMeal, setSelectedMeal] = useState<MealDashboardItem | null>(null)
  const [selectedMealClientName, setSelectedMealClientName] = useState<string>('')

  // Модальное окно с отчётом о тренировке
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutDashboardItem | null>(null)
  const [selectedWorkoutClientName, setSelectedWorkoutClientName] = useState<string>('')
  const [workoutReport, setWorkoutReport] = useState<WorkoutSessionReport | null>(null)
  const [workoutReportLoading, setWorkoutReportLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      mealsApi.dashboard(),
      workoutsApi.dashboard(),
      chatApi.unread(),
    ])
      .then(([mealsRes, workoutsRes, unreadRes]) => {
        setMealsDashboard(mealsRes.data)
        setWorkoutsDashboard(workoutsRes.data)
        setUnreadByClient(unreadRes.data.by_client)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Дашборд</h1>

      {/* Client Summary Cards */}
      {mealsDashboard && mealsDashboard.clients.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
          {mealsDashboard.clients.map(client => {
            const caloriesPercent = Math.round((client.totals.calories / client.norms.calories) * 100)
            const unreadCount = unreadByClient[client.client_id] || 0
            return (
              <Link
                key={client.client_id}
                to={`/clients/${client.client_id}`}
                className="bg-card rounded-lg border border-border p-3 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground truncate">{client.client_name}</span>
                  {unreadCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded-full">
                      <MessageSquare size={10} />
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-lg font-bold text-foreground">{client.meals.length}</span>
                  <span className="text-xs text-muted-foreground">приёмов</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    {client.totals.calories}/{client.norms.calories} ккал
                  </span>
                  <span className={`text-sm font-semibold ${caloriesPercent >= 100 ? 'text-green-500' : caloriesPercent >= 70 ? 'text-yellow-500' : 'text-orange-500'}`}>
                    {caloriesPercent}%
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

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

          <div className="overflow-x-auto md:overflow-visible">
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap lg:flex-nowrap lg:overflow-x-auto pb-2">
              {mealsDashboard.clients.map(client => {
                const caloriesPercent = Math.round((client.totals.calories / client.norms.calories) * 100)
                return (
                <div key={client.client_id} className="w-full md:w-64 flex-shrink-0 bg-muted rounded-lg p-3">
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
                        <div
                          key={meal.id}
                          className="flex items-center gap-2 bg-card rounded-lg p-2 cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            setSelectedMeal(meal)
                            setSelectedMealClientName(client.client_name)
                          }}
                        >
                          {meal.thumbnail && (
                            <img src={meal.thumbnail} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{meal.dish_name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {meal.meal_time} • {meal.calories} ккал
                              {meal.ai_comment && <MessageSquare size={10} className="inline ml-1 text-blue-400" />}
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

          <div className="overflow-x-auto md:overflow-visible">
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap lg:flex-nowrap lg:overflow-x-auto pb-2">
              {workoutsDashboard.clients.map(client => (
                <div key={client.client_id} className="w-full md:w-64 flex-shrink-0 bg-muted rounded-lg p-3">
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
                        <div
                          key={workout.id}
                          className="flex items-center gap-2 bg-card rounded-lg p-2 cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            setSelectedWorkout(workout)
                            setSelectedWorkoutClientName(client.client_name)
                            setWorkoutReport(null)
                            setWorkoutReportLoading(true)
                            workoutsApi.assignmentReport(workout.id)
                              .then(res => setWorkoutReport(res.data))
                              .catch(() => setWorkoutReport(null))
                              .finally(() => setWorkoutReportLoading(false))
                          }}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            workout.status === 'completed'
                              ? (workout.session?.completion_percentage != null && workout.session.completion_percentage < 100
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-green-500/20 text-green-400')
                              : workout.status === 'in_progress' || workout.status === 'active'
                                ? 'bg-blue-500/20 text-blue-400'
                                : workout.status === 'skipped'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {workout.status === 'completed' ? <Check size={16} /> :
                             workout.status === 'in_progress' || workout.status === 'active' ? <Play size={16} /> :
                             <Clock size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{workout.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {workout.scheduled_time || '—'} • {workout.exercises_count} упр.
                              {workout.session && (
                                <span className={
                                  workout.status === 'completed'
                                    ? (workout.session.completion_percentage === 100 ? 'text-green-400' : 'text-orange-400')
                                    : 'text-blue-400'
                                }> • {workout.session.completion_percentage}%</span>
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

      {/* Workout Report Modal */}
      {selectedWorkout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedWorkout(null)}>
          <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground truncate">
                    {workoutReport?.workout_name || selectedWorkout.name}
                  </h2>
                  {selectedWorkout.status === 'in_progress' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                      В процессе
                    </span>
                  )}
                  {selectedWorkout.status === 'completed' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                      <Check size={12} />
                      Выполнено
                    </span>
                  )}
                  {(selectedWorkout.status === 'scheduled' || selectedWorkout.status === 'draft') && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium">
                      <Clock size={12} />
                      Ожидает
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{selectedWorkoutClientName}</p>
              </div>
              <button onClick={() => setSelectedWorkout(null)} className="p-1 hover:bg-muted rounded-lg transition-colors ml-2">
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {workoutReportLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 size={24} className="text-blue-400 animate-spin" />
                  <p className="text-sm text-muted-foreground mt-2">Загрузка отчёта...</p>
                </div>
              ) : workoutReport ? (
                <>
                  {/* Session info */}
                  {workoutReport.session && (
                    <div className="bg-muted rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Начало</span>
                        <span className="text-foreground font-medium">
                          {new Date(workoutReport.session.started_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {workoutReport.session.completed_at && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Окончание</span>
                          <span className="text-foreground font-medium">
                            {new Date(workoutReport.session.completed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      {workoutReport.session.duration_seconds != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Длительность</span>
                          <span className="text-foreground font-medium flex items-center gap-1">
                            <Timer size={14} />
                            {Math.floor(workoutReport.session.duration_seconds / 60)} мин
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {!workoutReport.session && (
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-sm text-muted-foreground">Тренировка ещё не начата</p>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-500/20 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-blue-400">
                        {workoutReport.totals.completed_exercises}/{workoutReport.totals.planned_exercises}
                      </div>
                      <div className="text-[10px] text-muted-foreground">упражнений</div>
                    </div>
                    <div className="bg-purple-500/20 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-purple-400">
                        {workoutReport.totals.completed_sets}/{workoutReport.totals.total_sets}
                      </div>
                      <div className="text-[10px] text-muted-foreground">подходов</div>
                    </div>
                    <div className="bg-orange-500/20 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-orange-400">
                        {workoutReport.totals.volume_kg > 0 ? `${workoutReport.totals.volume_kg}` : '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">объём (кг)</div>
                    </div>
                  </div>

                  {/* Exercises list */}
                  <div>
                    <h3 className="text-sm font-medium text-secondary-foreground mb-2">Упражнения</h3>
                    <div className="space-y-2">
                      {workoutReport.planned_exercises.map(ex => (
                        <div key={ex.exercise_id} className="bg-muted rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              ex.is_completed ? 'bg-green-500/20 text-green-400' :
                              ex.actual_sets.length > 0 ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-500/20 text-gray-500'
                            }`}>
                              {ex.is_completed ? <Check size={14} /> :
                               ex.actual_sets.length > 0 ? <Play size={12} /> :
                               <Clock size={12} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">{ex.exercise_name}</span>
                                <span className="text-xs text-muted-foreground">{ex.actual_sets.length}/{ex.planned_sets} подх.</span>
                              </div>
                              {ex.muscle_group && (
                                <span className="text-[10px] text-muted-foreground">{ex.muscle_group}</span>
                              )}

                              {/* Plan info */}
                              <div className="text-xs text-muted-foreground mt-1">
                                План: {ex.planned_sets} × {ex.planned_reps ? `${ex.planned_reps} повт.` : ''}{ex.planned_weight ? ` × ${ex.planned_weight} кг` : ''}{ex.planned_duration_seconds ? `${ex.planned_duration_seconds} сек` : ''}
                              </div>

                              {/* Actual sets */}
                              {ex.actual_sets.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {ex.actual_sets.map(s => (
                                    <div key={s.set_number} className="flex items-center gap-2 text-xs">
                                      <span className="text-muted-foreground w-4">{s.set_number}.</span>
                                      <span className="text-foreground">
                                        {s.reps > 0 && `${s.reps} повт.`}
                                        {s.weight_kg != null && ` × ${s.weight_kg} кг`}
                                        {s.duration_seconds != null && `${s.duration_seconds} сек`}
                                      </span>
                                      {s.completed_at && (
                                        <span className="text-muted-foreground ml-auto">
                                          {new Date(s.completed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">Не удалось загрузить отчёт</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Meal Detail Modal */}
      {selectedMeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMeal(null)}>
          <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground truncate">{selectedMeal.dish_name}</h2>
                <p className="text-xs text-muted-foreground">{selectedMealClientName} • {selectedMeal.meal_time}</p>
              </div>
              <button onClick={() => setSelectedMeal(null)} className="p-1 hover:bg-muted rounded-lg transition-colors ml-2">
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Image */}
              {selectedMeal.image && (
                <div className="rounded-lg overflow-hidden">
                  <img src={selectedMeal.image} alt={selectedMeal.dish_name} className="w-full h-auto max-h-64 object-cover" />
                </div>
              )}

              {/* KBJU Summary */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-orange-500/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-orange-400">{selectedMeal.calories}</div>
                  <div className="text-[10px] text-muted-foreground">ккал</div>
                </div>
                <div className="bg-red-500/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-red-400">{selectedMeal.proteins}</div>
                  <div className="text-[10px] text-muted-foreground">белки</div>
                </div>
                <div className="bg-yellow-500/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-yellow-400">{selectedMeal.fats}</div>
                  <div className="text-[10px] text-muted-foreground">жиры</div>
                </div>
                <div className="bg-blue-500/20 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-400">{selectedMeal.carbs}</div>
                  <div className="text-[10px] text-muted-foreground">углеводы</div>
                </div>
              </div>

              {/* Ingredients */}
              {selectedMeal.ingredients && selectedMeal.ingredients.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-secondary-foreground mb-2">Ингредиенты</h3>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMeal.ingredients.map((ingredient, idx) => (
                        <span key={idx} className="text-xs bg-secondary px-2 py-1 rounded-md text-secondary-foreground">
                          {typeof ingredient === 'string' ? ingredient : (ingredient as { name?: string }).name || String(ingredient)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Comment */}
              {selectedMeal.ai_comment && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={14} className="text-blue-400" />
                    <h3 className="text-sm font-medium text-secondary-foreground">Комментарий AI</h3>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <p className="text-sm text-foreground whitespace-pre-line">{selectedMeal.ai_comment}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
