import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Loader2, Minus, Plus, Trophy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/client'

interface ReportSet {
  set_number: number
  completed: boolean
  reps: number
  weight_kg: number | null
  duration_seconds: number | null
}

interface ReportExercise {
  exercise_id: string
  name: string
  muscle_group: string
  category: string
  expanded: boolean
  sets: ReportSet[]
}

export default function WorkoutReport() {
  const { id: workoutId } = useParams()
  const [searchParams] = useSearchParams()
  const assignmentId = searchParams.get('assignment')
  const navigate = useNavigate()

  const [workoutName, setWorkoutName] = useState('')
  const [exercises, setExercises] = useState<ReportExercise[]>([])
  const [durationMinutes, setDurationMinutes] = useState<number>(45)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{
    exercises: number
    sets: number
    volume_kg: number
    completion_percent: number
  } | null>(null)

  useEffect(() => {
    if (workoutId) fetchData()
  }, [workoutId])

  const fetchData = async () => {
    try {
      const [workoutRes, exercisesRes] = await Promise.all([
        api.get(`/workouts/fitdb/workouts/${workoutId}/`),
        api.get('/workouts/fitdb/workout-exercises/', { params: { workout_id: workoutId } }),
      ])

      setWorkoutName(workoutRes.data.name)

      const list = Array.isArray(exercisesRes.data) ? exercisesRes.data : (exercisesRes.data.results || [])
      const sorted = list.sort((a: any, b: any) => a.order_index - b.order_index)

      setExercises(sorted.map((we: any) => {
        const ex = we.exercise || {}
        const isTimeBased = ['cardio', 'warmup', 'cooldown', 'flexibility'].includes(ex.category || '')
        const setsCount = we.sets || 1

        return {
          exercise_id: String(ex.id || we.exercise_id),
          name: ex.name || 'Упражнение',
          muscle_group: ex.muscle_group || '',
          category: ex.category || 'strength',
          expanded: false,
          sets: Array.from({ length: setsCount }, (_, i) => ({
            set_number: i + 1,
            completed: true,
            reps: isTimeBased ? 1 : (we.reps || 10),
            weight_kg: isTimeBased ? null : (we.weight_kg || null),
            duration_seconds: isTimeBased ? (we.duration_seconds || 60) : null,
          })),
        } as ReportExercise
      }))
    } catch (error) {
      console.error('Error fetching workout data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExercise = (index: number) => {
    setExercises(prev => prev.map((ex, i) =>
      i === index ? { ...ex, expanded: !ex.expanded } : ex
    ))
  }

  const toggleAllSets = (exIndex: number) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIndex) return ex
      const allCompleted = ex.sets.every(s => s.completed)
      return { ...ex, sets: ex.sets.map(s => ({ ...s, completed: !allCompleted })) }
    }))
  }

  const toggleSet = (exIndex: number, setIndex: number) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIndex) return ex
      return {
        ...ex,
        sets: ex.sets.map((s, si) =>
          si === setIndex ? { ...s, completed: !s.completed } : s
        ),
      }
    }))
  }

  const updateSetValue = (exIndex: number, setIndex: number, field: 'reps' | 'weight_kg' | 'duration_seconds', delta: number) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIndex) return ex
      return {
        ...ex,
        sets: ex.sets.map((s, si) => {
          if (si !== setIndex) return s
          const current = s[field] || 0
          const newVal = Math.max(0, current + delta)
          return { ...s, [field]: newVal || null }
        }),
      }
    }))
  }

  const handleSubmit = async () => {
    const payload = {
      workout_id: Number(workoutId),
      assignment_id: assignmentId ? Number(assignmentId) : undefined,
      duration_minutes: durationMinutes || undefined,
      exercises: exercises
        .filter(ex => ex.sets.some(s => s.completed))
        .map(ex => ({
          exercise_id: Number(ex.exercise_id),
          sets: ex.sets
            .filter(s => s.completed)
            .map(s => ({
              set_number: s.set_number,
              reps: s.reps,
              weight_kg: s.weight_kg,
              duration_seconds: s.duration_seconds,
            })),
        })),
    }

    if (payload.exercises.length === 0) return

    setSubmitting(true)
    try {
      const { data } = await api.post('/workouts/sessions/submit-report/', payload)
      setSuccess(data.totals)
    } catch (error) {
      console.error('Error submitting report:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const completedSets = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0)
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
  const completionPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0

  const getMuscleGroupColor = (group: string) => {
    const colors: Record<string, string> = {
      'Грудь': 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      'Спина': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      'Плечи': 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      'Ноги': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      'Ягодицы': 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
      'Руки': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      'Пресс': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Кардио': 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
      'Chest': 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      'Back': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      'Shoulders': 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      'Legs': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      'Arms': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      'Abs': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Cardio': 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    }
    return colors[group] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? (s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m} мин`) : `${s} сек`
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  // Экран успеха
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6"
        >
          <Trophy className="w-10 h-10 text-green-500" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
        >
          Отчёт сохранён!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-500 dark:text-gray-400 mb-8"
        >
          {workoutName}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 gap-3 w-full max-w-xs mb-8"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">Упражнений</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{success.exercises}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">Подходов</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{success.sets}</p>
          </div>
          {success.volume_kg > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Объём</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{success.volume_kg} кг</p>
            </div>
          )}
          {success.completion_percent > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Выполнение</p>
              <p className="text-xl font-bold text-green-500">{success.completion_percent}%</p>
            </div>
          )}
        </motion.div>

        <button
          onClick={() => navigate('/workouts')}
          className="w-full max-w-xs bg-blue-500 text-white rounded-2xl py-4 font-semibold active:scale-[0.98] transition-transform"
        >
          Готово
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 pb-32">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-blue-500 mb-4 -ml-1"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Назад</span>
      </button>

      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Отчёт о тренировке</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{workoutName}</p>

      {/* Duration */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 mb-4">
        <label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">Длительность (мин)</label>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setDurationMinutes(prev => Math.max(5, prev - 5))}
            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Minus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-3xl font-bold text-gray-900 dark:text-white w-16 text-center">{durationMinutes}</span>
          <button
            onClick={() => setDurationMinutes(prev => prev + 5)}
            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {completedSets}/{totalSets}
        </span>
      </div>

      {/* Exercises */}
      <div className="space-y-3">
        {exercises.map((ex, exIndex) => {
          const allCompleted = ex.sets.every(s => s.completed)
          const someCompleted = ex.sets.some(s => s.completed)
          const isTimeBased = ['cardio', 'warmup', 'cooldown', 'flexibility'].includes(ex.category)

          return (
            <div
              key={ex.exercise_id + '-' + exIndex}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            >
              {/* Exercise header */}
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => toggleAllSets(exIndex)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                    allCompleted
                      ? 'bg-green-500 border-green-500'
                      : someCompleted
                        ? 'bg-green-200 border-green-300 dark:bg-green-900 dark:border-green-700'
                        : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {allCompleted && <Check className="w-4 h-4 text-white" />}
                </button>
                <div className="flex-1 min-w-0" onClick={() => toggleExercise(exIndex)}>
                  <h3 className={`font-medium text-sm ${allCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {ex.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ex.muscle_group && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${getMuscleGroupColor(ex.muscle_group)}`}>
                        {ex.muscle_group}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {ex.sets.filter(s => s.completed).length}/{ex.sets.length} подходов
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleExercise(exIndex)}
                  className="p-1 text-gray-400"
                >
                  {ex.expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {/* Sets (expandable) */}
              <AnimatePresence>
                {ex.expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2">
                      {ex.sets.map((set, setIndex) => (
                        <div
                          key={set.set_number}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                            set.completed
                              ? 'bg-gray-50 dark:bg-gray-800'
                              : 'bg-gray-50/50 dark:bg-gray-800/50 opacity-50'
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleSet(exIndex, setIndex)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                              set.completed
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {set.completed && <Check className="w-3 h-3 text-white" />}
                          </button>

                          <span className="text-xs text-gray-400 w-5">{set.set_number}</span>

                          {/* Parameters */}
                          {isTimeBased ? (
                            <div className="flex items-center gap-1 flex-1 justify-end">
                              <button
                                onClick={() => updateSetValue(exIndex, setIndex, 'duration_seconds', -30)}
                                className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-medium w-14 text-center text-gray-900 dark:text-white">
                                {formatDuration(set.duration_seconds || 0)}
                              </span>
                              <button
                                onClick={() => updateSetValue(exIndex, setIndex, 'duration_seconds', 30)}
                                className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 flex-1 justify-end">
                              {/* Reps */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => updateSetValue(exIndex, setIndex, 'reps', -1)}
                                  className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-sm font-medium w-8 text-center text-gray-900 dark:text-white">
                                  {set.reps}
                                </span>
                                <button
                                  onClick={() => updateSetValue(exIndex, setIndex, 'reps', 1)}
                                  className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <span className="text-[10px] text-gray-400">повт</span>
                              </div>

                              {/* Weight */}
                              {set.weight_kg !== null && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateSetValue(exIndex, setIndex, 'weight_kg', -2.5)}
                                    className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-sm font-medium w-10 text-center text-blue-600 dark:text-blue-400">
                                    {set.weight_kg}
                                  </span>
                                  <button
                                    onClick={() => updateSetValue(exIndex, setIndex, 'weight_kg', 2.5)}
                                    className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <span className="text-[10px] text-gray-400">кг</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Submit button */}
      <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto">
        <button
          onClick={handleSubmit}
          disabled={submitting || completedSets === 0}
          className="w-full bg-green-500 text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Check className="w-5 h-5" />
              Сохранить отчёт ({completionPercent}%)
            </>
          )}
        </button>
      </div>
    </div>
  )
}
