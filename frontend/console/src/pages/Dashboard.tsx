import { useEffect, useState } from 'react'
import { Utensils, Dumbbell, X, Check, Clock, Play, MessageSquare } from 'lucide-react'
import { mealsApi, workoutsApi, type MealsDashboardResponse, type WorkoutsDashboardResponse, type MealDashboardItem } from '../api/data'

export default function Dashboard() {
  const [mealsDashboard, setMealsDashboard] = useState<MealsDashboardResponse | null>(null)
  const [workoutsDashboard, setWorkoutsDashboard] = useState<WorkoutsDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Модальное окно с деталями блюда
  const [selectedMeal, setSelectedMeal] = useState<MealDashboardItem | null>(null)
  const [selectedMealClientName, setSelectedMealClientName] = useState<string>('')

  useEffect(() => {
    Promise.all([
      mealsApi.dashboard(),
      workoutsApi.dashboard(),
    ])
      .then(([mealsRes, workoutsRes]) => {
        setMealsDashboard(mealsRes.data)
        setWorkoutsDashboard(workoutsRes.data)
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
            return (
              <div key={client.client_id} className="bg-card rounded-lg border border-border p-3">
                <div className="text-sm font-medium text-foreground truncate mb-2">{client.client_name}</div>
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
              </div>
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
