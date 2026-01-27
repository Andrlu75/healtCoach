import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>({})
  const [restTime, setRestTime] = useState(0)
  const [isResting, setIsResting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showExerciseList, setShowExerciseList] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<Date>(new Date())

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
          }

          try {
            const { data: ex } = await api.get(`/exercises/fitdb/exercises/${we.exercise_id}/`)
            exerciseDetails = {
              id: String(ex.id),
              name: ex.name,
              muscle_group: ex.muscle_group || '',
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

  const currentExercise = exercises[currentExerciseIndex]
  const currentSets = currentExercise ? setLogs[currentExercise.id] || [] : []
  const totalCompletedExercises = exercises.filter(ex =>
    (setLogs[ex.id] || []).every(s => s.completed)
  ).length

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

  const goToNextExercise = () => {
    if (currentExerciseIndex < exercises.length - 1) {
      selection()
      setCurrentExerciseIndex(prev => prev + 1)
      setIsResting(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
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

  if (loading || !currentExercise) {
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
          <p className="text-xs text-gray-500 dark:text-gray-400">Упражнение</p>
          <p className="font-semibold text-gray-900 dark:text-white">{currentExerciseIndex + 1} / {exercises.length}</p>
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

      {/* Exercise Selector */}
      <button
        onClick={() => {
          selection()
          setShowExerciseList(!showExerciseList)
        }}
        className="w-full bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 mb-4 flex items-center justify-between"
      >
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{currentExercise.exercise.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentExercise.exercise.muscle_group}</p>
        </div>
        {showExerciseList ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {/* Exercise List Dropdown */}
      {showExerciseList && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 mb-4 overflow-hidden">
          {exercises.map((ex, index) => {
            const exSets = setLogs[ex.id] || []
            const isComplete = exSets.every(s => s.completed)
            return (
              <button
                key={ex.id}
                onClick={() => {
                  selection()
                  setCurrentExerciseIndex(index)
                  setShowExerciseList(false)
                }}
                className={`w-full p-3 flex items-center gap-3 border-b border-gray-50 dark:border-gray-800 last:border-b-0 ${
                  index === currentExerciseIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isComplete ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className={`flex-1 text-left text-sm ${isComplete ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                  {ex.exercise.name}
                </span>
              </button>
            )
          })}
        </div>
      )}

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
              backgroundColor: set.completed ? 'rgb(240, 253, 244)' : undefined,
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

      {/* Next/Finish Button */}
      <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {currentSets.every(s => s.completed) && (
            currentExerciseIndex < exercises.length - 1 ? (
              <motion.button
                key="next"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={goToNextExercise}
                className="w-full bg-green-500 text-white rounded-2xl py-4 font-semibold shadow-lg"
              >
                Следующее упражнение
              </motion.button>
            ) : allExercisesCompleted ? (
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
            ) : null
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
