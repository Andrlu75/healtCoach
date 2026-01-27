import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Plus, Minus, Info, Play, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/client'
import { useHaptic } from '../../shared/hooks'

interface Exercise {
  id: string
  order_index: number
  sets: number
  reps: number
  rest_seconds: number
  weight_kg: number | null
  exercise: {
    id: string
    name: string
    muscle_group: string
    description: string | null
  }
}

interface SetLog {
  set_number: number
  reps: number
  weight: number | null
  completed: boolean
}

export default function WorkoutRun() {
  const { id: workoutId } = useParams()
  const [searchParams] = useSearchParams()
  const assignmentId = searchParams.get('assignment')
  const navigate = useNavigate()
  const { notification, selection } = useHaptic()

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number | null>(null)
  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>({})
  const [restTime, setRestTime] = useState(0)
  const [isResting, setIsResting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<Date>(new Date())
  const exerciseListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (workoutId) {
      fetchExercises()
      createSession()
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [workoutId])

  const createSession = async () => {
    try {
      const { data } = await api.post('/workouts/sessions/', { workout_id: workoutId })
      setSessionId(String(data.id))
    } catch (error) {
      console.error('Error creating session:', error)
    }
  }

  const fetchExercises = async () => {
    try {
      const { data: exercisesData } = await api.get('/workouts/fitdb/workout-exercises/', {
        params: { workout_id: workoutId }
      })
      const exercisesList = Array.isArray(exercisesData) ? exercisesData : (exercisesData.results || [])

      // Fetch exercise details for each workout exercise
      const exercisesWithDetails = await Promise.all(
        exercisesList.map(async (we: any) => {
          let exerciseDetails = {
            id: String(we.exercise_id),
            name: 'Упражнение',
            muscle_group: '',
            description: null as string | null,
          }

          try {
            const { data: ex } = await api.get(`/exercises/fitdb/exercises/${we.exercise_id}/`)
            exerciseDetails = {
              id: String(ex.id),
              name: ex.name,
              muscle_group: ex.muscle_group || '',
              description: ex.description || null,
            }
          } catch {
            // Use defaults
          }

          return {
            id: String(we.id),
            order_index: we.order_index,
            sets: we.sets,
            reps: we.reps,
            rest_seconds: we.rest_seconds,
            weight_kg: we.weight_kg,
            exercise: exerciseDetails,
          } as Exercise
        })
      )

      // Sort by order_index
      exercisesWithDetails.sort((a, b) => a.order_index - b.order_index)
      setExercises(exercisesWithDetails)

      // Initialize set logs
      const logs: Record<string, SetLog[]> = {}
      exercisesWithDetails.forEach((ex) => {
        logs[ex.id] = Array.from({ length: ex.sets }, (_, i) => ({
          set_number: i + 1,
          reps: ex.reps,
          weight: ex.weight_kg,
          completed: false,
        }))
      })
      setSetLogs(logs)
    } catch (error) {
      console.error('Error fetching exercises:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentExercise = currentExerciseIndex !== null ? exercises[currentExerciseIndex] : null
  const currentSets = currentExercise ? setLogs[currentExercise.id] || [] : []
  const totalCompletedExercises = exercises.filter(ex =>
    (setLogs[ex.id] || []).every(s => s.completed)
  ).length

  const getExerciseStatus = (ex: Exercise) => {
    const sets = setLogs[ex.id] || []
    const completedSets = sets.filter(s => s.completed).length
    if (completedSets === sets.length) return 'completed'
    if (completedSets > 0) return 'in_progress'
    return 'pending'
  }

  const startRest = useCallback((seconds: number) => {
    setRestTime(seconds)
    setIsResting(true)

    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setRestTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setIsResting(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const completeSet = async (setIndex: number) => {
    if (!currentExercise || !sessionId) return

    const set = currentSets[setIndex]
    selection()

    // Log to database
    try {
      await api.post('/workouts/exercise-logs/', {
        session_id: sessionId,
        exercise_id: currentExercise.exercise.id,
        set_number: set.set_number,
        reps_completed: set.reps,
        weight_kg: set.weight || undefined,
      })
    } catch (error) {
      console.error('Error logging set:', error)
    }

    // Update local state
    setSetLogs(prev => ({
      ...prev,
      [currentExercise.id]: prev[currentExercise.id].map((s, i) =>
        i === setIndex ? { ...s, completed: true } : s
      ),
    }))

    // Start rest timer if not last set
    if (setIndex < currentSets.length - 1) {
      startRest(currentExercise.rest_seconds)
    }
  }

  const updateSetValue = (setIndex: number, field: 'reps' | 'weight', delta: number) => {
    if (!currentExercise) return
    selection()

    setSetLogs(prev => ({
      ...prev,
      [currentExercise.id]: prev[currentExercise.id].map((s, i) => {
        if (i !== setIndex) return s
        const value = field === 'reps' ? s.reps : (s.weight || 0)
        const newValue = Math.max(0, value + delta)
        return { ...s, [field]: field === 'weight' && newValue === 0 ? null : newValue }
      }),
    }))
  }

  const startExercise = (index: number) => {
    selection()
    setCurrentExerciseIndex(index)
    setSelectedExercise(null)
    setIsResting(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const finishWorkout = async () => {
    if (!sessionId) return
    notification('success')

    const duration = Math.floor((new Date().getTime() - startTimeRef.current.getTime()) / 1000)

    try {
      // Update session
      await api.patch(`/workouts/sessions/${sessionId}/`, {
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
      })

      // Update assignment status
      if (assignmentId) {
        await api.patch(`/workouts/assignments/${assignmentId}/`, { status: 'completed' })
      }
    } catch (error) {
      console.error('Error finishing workout:', error)
    }

    navigate('/workouts')
  }

  const allExercisesCompleted = exercises.every(ex =>
    (setLogs[ex.id] || []).every(s => s.completed)
  )

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getMuscleGroupColor = (group: string) => {
    const colors: Record<string, string> = {
      'Chest': 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      'Back': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      'Shoulders': 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      'Legs': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      'Glutes': 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
      'Arms': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      'Abs': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Cardio': 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
      'Грудь': 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      'Спина': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      'Плечи': 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      'Ноги': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      'Ягодицы': 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
      'Руки': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      'Пресс': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Кардио': 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    }
    return colors[group] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">Загрузка...</div>
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(`/workouts/${workoutId}?assignment=${assignmentId}`)}
          className="flex items-center gap-2 text-blue-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Прогресс</p>
          <p className="font-semibold text-gray-900 dark:text-white">{totalCompletedExercises} / {exercises.length}</p>
        </div>
        <div className="w-10" />
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${(totalCompletedExercises / exercises.length) * 100}%` }}
        />
      </div>

      {/* Exercise Cards - Horizontal Scroll */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Упражнения</h3>
        <div
          ref={exerciseListRef}
          className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {exercises.map((ex, index) => {
            const status = getExerciseStatus(ex)
            const sets = setLogs[ex.id] || []
            const completedSets = sets.filter(s => s.completed).length
            const isActive = currentExerciseIndex === index

            return (
              <motion.div
                key={ex.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  selection()
                  setSelectedExercise(ex)
                }}
                className={`flex-shrink-0 w-32 rounded-2xl p-3 border-2 cursor-pointer transition-colors ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : status === 'completed'
                    ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                    : status === 'in_progress'
                    ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700'
                    : 'border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    status === 'completed'
                      ? 'bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-300'
                      : status === 'in_progress'
                      ? 'bg-yellow-200 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-300'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {index + 1}
                  </span>
                  {status === 'completed' && (
                    <Check className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                  {ex.exercise.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {completedSets}/{sets.length} подходов
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Exercise Info Modal */}
      <AnimatePresence>
        {selectedExercise && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
            onClick={() => setSelectedExercise(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white dark:bg-gray-900 rounded-t-3xl w-full max-w-md p-6 pb-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedExercise.exercise.name}
                  </h3>
                  {selectedExercise.exercise.muscle_group && (
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs ${getMuscleGroupColor(selectedExercise.exercise.muscle_group)}`}>
                      {selectedExercise.exercise.muscle_group}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedExercise(null)}
                  className="p-2 -mr-2 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Exercise params */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedExercise.sets}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">подходов</p>
                </div>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedExercise.reps}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">повторений</p>
                </div>
                {selectedExercise.weight_kg && (
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedExercise.weight_kg}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">кг</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedExercise.exercise.description && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Описание</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {selectedExercise.exercise.description}
                  </p>
                </div>
              )}

              {/* Start button */}
              <button
                onClick={() => startExercise(exercises.findIndex(e => e.id === selectedExercise.id))}
                className="w-full bg-blue-500 text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" fill="white" />
                Начать упражнение
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Exercise Sets */}
      {currentExercise ? (
        <>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{currentExercise.exercise.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentExercise.sets} × {currentExercise.reps} повт
              {currentExercise.weight_kg && ` · ${currentExercise.weight_kg} кг`}
            </p>
          </div>

          {/* Rest Timer */}
          <AnimatePresence>
            {isResting && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-blue-500 rounded-2xl p-6 mb-4 text-center text-white"
              >
                <p className="text-sm opacity-80 mb-1">Отдых</p>
                <motion.p
                  key={restTime}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-4xl font-bold"
                >
                  {formatTime(restTime)}
                </motion.p>
                <button
                  onClick={() => {
                    selection()
                    setIsResting(false)
                    if (timerRef.current) clearInterval(timerRef.current)
                  }}
                  className="mt-3 text-sm underline opacity-80"
                >
                  Пропустить
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sets */}
          <div className="space-y-3">
            {currentSets.map((set, index) => (
              <motion.div
                key={index}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 24,
                  delay: index * 0.05,
                }}
                className={`rounded-2xl p-4 border ${
                  set.completed
                    ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                    : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Подход {set.set_number}</span>
                  <AnimatePresence>
                    {set.completed && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <Check className="w-5 h-5 text-green-500" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence mode="wait">
                  {!set.completed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Reps Control */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Повторения</span>
                        <div className="flex items-center gap-3">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => updateSetValue(index, 'reps', -1)}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                          >
                            <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </motion.button>
                          <motion.span
                            key={set.reps}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            className="w-8 text-center font-semibold text-gray-900 dark:text-white"
                          >
                            {set.reps}
                          </motion.span>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => updateSetValue(index, 'reps', 1)}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </motion.button>
                        </div>
                      </div>

                      {/* Weight Control */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Вес (кг)</span>
                        <div className="flex items-center gap-3">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => updateSetValue(index, 'weight', -2.5)}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                          >
                            <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </motion.button>
                          <motion.span
                            key={set.weight}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            className="w-12 text-center font-semibold text-gray-900 dark:text-white"
                          >
                            {set.weight ?? '-'}
                          </motion.span>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => updateSetValue(index, 'weight', 2.5)}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </motion.button>
                        </div>
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => completeSet(index)}
                        className="w-full bg-blue-500 text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Выполнено
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-2">Выберите упражнение для начала</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Нажмите на карточку упражнения выше</p>
        </div>
      )}

      {/* Finish Button */}
      <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {allExercisesCompleted && (
            <motion.button
              key="finish"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={finishWorkout}
              className="w-full bg-green-500 text-white rounded-2xl py-4 font-semibold shadow-lg"
            >
              Завершить тренировку
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
