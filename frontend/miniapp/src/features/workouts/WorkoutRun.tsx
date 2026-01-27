import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Plus, Minus, Info, Play, X, Flag, Trophy } from 'lucide-react'
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
  skipped?: boolean
}

interface WorkoutStats {
  totalSets: number
  completedSets: number
  skippedSets: number
  totalExercises: number
  completedExercises: number
  partialExercises: number
  completionPercent: number
  duration: number
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
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [finalStats, setFinalStats] = useState<WorkoutStats | null>(null)
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
      const newSessionId = String(data.id)
      setSessionId(newSessionId)
      // Log workout started
      logActivity(newSessionId, 'workout_started', null, null, {})
    } catch (error) {
      console.error('Error creating session:', error)
    }
  }

  // Log activity for coach analysis
  const logActivity = async (
    sid: string,
    eventType: string,
    exerciseId: string | null,
    setNumber: number | null,
    details: Record<string, any>
  ) => {
    try {
      await api.post('/workouts/activity-logs/', {
        session_id: sid,
        event_type: eventType,
        exercise_id: exerciseId,
        set_number: setNumber,
        details,
      })
    } catch (error) {
      console.error('Error logging activity:', error)
    }
  }

  const fetchExercises = async () => {
    try {
      const { data: exercisesData } = await api.get('/workouts/fitdb/workout-exercises/', {
        params: { workout_id: workoutId }
      })
      const exercisesList = Array.isArray(exercisesData) ? exercisesData : (exercisesData.results || [])

      // Exercise details are now included in the response - no extra API calls needed
      const exercisesWithDetails = exercisesList.map((we: any) => {
        const exerciseDetails = we.exercise ? {
          id: String(we.exercise.id),
          name: we.exercise.name || 'Упражнение',
          muscle_group: we.exercise.muscle_group || '',
          description: we.exercise.description || null,
        } : {
          id: String(we.exercise_id),
          name: 'Упражнение',
          muscle_group: '',
          description: null as string | null,
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

      exercisesWithDetails.sort((a: Exercise, b: Exercise) => a.order_index - b.order_index)
      setExercises(exercisesWithDetails)

      const logs: Record<string, SetLog[]> = {}
      exercisesWithDetails.forEach((ex: Exercise) => {
        logs[ex.id] = Array.from({ length: ex.sets }, (_, i) => ({
          set_number: i + 1,
          reps: ex.reps,
          weight: ex.weight_kg,
          completed: false,
          skipped: false,
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

  const calculateStats = (): WorkoutStats => {
    let totalSets = 0
    let completedSets = 0
    let skippedSets = 0
    let completedExercises = 0
    let partialExercises = 0

    exercises.forEach(ex => {
      const sets = setLogs[ex.id] || []
      const completed = sets.filter(s => s.completed).length
      const skipped = sets.filter(s => s.skipped).length

      totalSets += sets.length
      completedSets += completed
      skippedSets += skipped

      if (completed === sets.length) {
        completedExercises++
      } else if (completed > 0) {
        partialExercises++
      }
    })

    const duration = Math.floor((new Date().getTime() - startTimeRef.current.getTime()) / 1000)
    const completionPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0

    return {
      totalSets,
      completedSets,
      skippedSets,
      totalExercises: exercises.length,
      completedExercises,
      partialExercises,
      completionPercent,
      duration,
    }
  }

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

    // Log rest started (don't await, fire and forget)
    if (sessionId && currentExercise) {
      logActivity(sessionId, 'rest_started', currentExercise.exercise.id, null, {
        rest_seconds: seconds,
      })
    }

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
  }, [sessionId, currentExercise])

  const completeSet = async (setIndex: number) => {
    if (!currentExercise || !sessionId) return

    const set = currentSets[setIndex]
    selection()

    try {
      await api.post('/workouts/exercise-logs/', {
        session_id: sessionId,
        exercise_id: currentExercise.exercise.id,
        set_number: set.set_number,
        reps_completed: set.reps,
        weight_kg: set.weight || undefined,
      })

      // Log set completed
      logActivity(sessionId, 'set_completed', currentExercise.exercise.id, set.set_number, {
        reps: set.reps,
        weight_kg: set.weight,
      })
    } catch (error) {
      console.error('Error logging set:', error)
    }

    setSetLogs(prev => ({
      ...prev,
      [currentExercise.id]: prev[currentExercise.id].map((s, i) =>
        i === setIndex ? { ...s, completed: true } : s
      ),
    }))

    // Check if exercise completed
    const updatedSets = currentSets.map((s, i) => i === setIndex ? { ...s, completed: true } : s)
    if (updatedSets.every(s => s.completed)) {
      logActivity(sessionId, 'exercise_completed', currentExercise.exercise.id, null, {
        total_sets: currentSets.length,
      })
    }

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

    // Log exercise started
    const exercise = exercises[index]
    if (sessionId && exercise) {
      logActivity(sessionId, 'exercise_started', exercise.exercise.id, null, {
        exercise_name: exercise.exercise.name,
        planned_sets: exercise.sets,
        planned_reps: exercise.reps,
      })
    }
  }

  const finishWorkout = async () => {
    if (!sessionId) return
    notification('success')

    const stats = calculateStats()
    setFinalStats(stats)

    // Log workout completed with full stats
    logActivity(sessionId, 'workout_completed', null, null, {
      duration_seconds: stats.duration,
      completion_percent: stats.completionPercent,
      total_sets: stats.totalSets,
      completed_sets: stats.completedSets,
      skipped_sets: stats.skippedSets,
      total_exercises: stats.totalExercises,
      completed_exercises: stats.completedExercises,
      partial_exercises: stats.partialExercises,
    })

    try {
      await api.patch(`/workouts/sessions/${sessionId}/`, {
        completed_at: new Date().toISOString(),
        duration_seconds: stats.duration,
      })

      if (assignmentId) {
        // Mark as completed only if > 50% done, otherwise mark as active
        const newStatus = stats.completionPercent >= 50 ? 'completed' : 'active'
        await api.patch(`/workouts/assignments/${assignmentId}/`, { status: newStatus })
      }
    } catch (error) {
      console.error('Error finishing workout:', error)
    }

    setShowFinishConfirm(false)
    setShowStats(true)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs} сек`
    return `${mins} мин ${secs} сек`
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

  // Calculate current progress for header
  const currentStats = calculateStats()

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
          <p className="text-xs text-gray-500 dark:text-gray-400">Выполнено</p>
          <p className="font-semibold text-gray-900 dark:text-white">{currentStats.completionPercent}%</p>
        </div>
        <div className="w-9" /> {/* Spacer for balance */}
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full mb-2 overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${currentStats.completionPercent}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-4">
        {currentStats.completedSets} из {currentStats.totalSets} подходов
      </p>

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
                  {status === 'completed' && <Check className="w-4 h-4 text-green-500" />}
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

      {/* Finish Confirmation Modal */}
      <AnimatePresence>
        {showFinishConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowFinishConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-4">
                  <Flag className="w-8 h-8 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Завершить тренировку?
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Выполнено {currentStats.completionPercent}% ({currentStats.completedSets} из {currentStats.totalSets} подходов)
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={finishWorkout}
                  className="w-full bg-orange-500 text-white rounded-2xl py-4 font-semibold"
                >
                  Да, завершить
                </button>
                <button
                  onClick={() => setShowFinishConfirm(false)}
                  className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl py-4 font-semibold"
                >
                  Продолжить тренировку
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Modal - Different views for complete vs partial */}
      <AnimatePresence>
        {showStats && finalStats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            {finalStats.completionPercent === 100 ? (
              /* Full completion celebration */
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="bg-gradient-to-b from-yellow-400 via-orange-500 to-red-500 rounded-3xl w-full max-w-sm p-1"
              >
                <div className="bg-white dark:bg-gray-900 rounded-[22px] p-6 relative overflow-hidden">
                  {/* Confetti animation */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{
                          y: -20,
                          x: Math.random() * 300,
                          rotate: 0,
                          opacity: 1
                        }}
                        animate={{
                          y: 400,
                          rotate: Math.random() * 360,
                          opacity: 0
                        }}
                        transition={{
                          duration: 2 + Math.random() * 2,
                          delay: Math.random() * 0.5,
                          repeat: Infinity,
                          ease: 'linear'
                        }}
                        className={`absolute w-3 h-3 rounded-sm ${
                          ['bg-yellow-400', 'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'][i % 6]
                        }`}
                        style={{ left: `${Math.random() * 100}%` }}
                      />
                    ))}
                  </div>

                  <div className="text-center mb-6 relative z-10">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.2 }}
                      className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg"
                    >
                      <Trophy className="w-12 h-12 text-white" />
                    </motion.div>

                    <motion.h3
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-3xl font-bold text-gray-900 dark:text-white mb-2"
                    >
                      МОЛОДЕЦ!
                    </motion.h3>

                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, delay: 0.4 }}
                    >
                      <p className="text-6xl mb-2">
                        <motion.span
                          animate={{ rotate: [0, -10, 10, -10, 0] }}
                          transition={{ duration: 0.5, delay: 0.6 }}
                        >
                          &#127881;
                        </motion.span>
                        &#127942;
                        <motion.span
                          animate={{ rotate: [0, 10, -10, 10, 0] }}
                          transition={{ duration: 0.5, delay: 0.7 }}
                        >
                          &#127881;
                        </motion.span>
                      </p>
                    </motion.div>

                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-lg text-gray-600 dark:text-gray-300"
                    >
                      Тренировка выполнена на
                    </motion.p>
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.6 }}
                      className="text-5xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent"
                    >
                      100%
                    </motion.p>
                  </div>

                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="space-y-2 mb-6 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Время</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatDuration(finalStats.duration)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Подходов</span>
                      <span className="font-semibold text-green-600">{finalStats.completedSets}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Упражнений</span>
                      <span className="font-semibold text-green-600">{finalStats.completedExercises}</span>
                    </div>
                  </motion.div>

                  <motion.button
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/workouts')}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl py-4 font-bold text-lg shadow-lg"
                  >
                    Отлично!
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              /* Partial completion - simple stats */
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm p-6"
              >
                <div className="text-center mb-6">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    finalStats.completionPercent >= 75
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : finalStats.completionPercent >= 50
                      ? 'bg-yellow-100 dark:bg-yellow-900/30'
                      : 'bg-orange-100 dark:bg-orange-900/30'
                  }`}>
                    <Flag className={`w-10 h-10 ${
                      finalStats.completionPercent >= 75
                        ? 'text-green-500'
                        : finalStats.completionPercent >= 50
                        ? 'text-yellow-500'
                        : 'text-orange-500'
                    }`} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Тренировка завершена
                  </h3>
                  <p className={`text-4xl font-bold mb-1 ${
                    finalStats.completionPercent >= 75
                      ? 'text-green-500'
                      : finalStats.completionPercent >= 50
                      ? 'text-yellow-500'
                      : 'text-orange-500'
                  }`}>
                    {finalStats.completionPercent}%
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">выполнено</p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400">Длительность</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{formatDuration(finalStats.duration)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400">Подходов выполнено</span>
                    <span className="font-semibold text-green-600">{finalStats.completedSets} из {finalStats.totalSets}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400">Упражнений полностью</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{finalStats.completedExercises} из {finalStats.totalExercises}</span>
                  </div>
                  {finalStats.partialExercises > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-gray-500 dark:text-gray-400">Упражнений частично</span>
                      <span className="font-semibold text-orange-500">{finalStats.partialExercises}</span>
                    </div>
                  )}
                  {finalStats.skippedSets > 0 && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-500 dark:text-gray-400">Пропущено подходов</span>
                      <span className="font-semibold text-gray-400">{finalStats.skippedSets}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate('/workouts')}
                  className="w-full bg-blue-500 text-white rounded-2xl py-4 font-semibold"
                >
                  Готово
                </button>
              </motion.div>
            )}
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
                    // Log rest skipped
                    if (sessionId && currentExercise) {
                      logActivity(sessionId, 'rest_skipped', currentExercise.exercise.id, null, {
                        remaining_seconds: restTime,
                      })
                    }
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
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 24,
                  delay: index * 0.05,
                }}
                className={`rounded-2xl p-4 border ${
                  set.completed
                    ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                    : set.skipped
                    ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800'
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
                    {set.skipped && (
                      <span className="text-xs text-orange-500">Пропущен</span>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence mode="wait">
                  {!set.completed && !set.skipped && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
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

      {/* Fixed bottom button - only show on exercise selection screen */}
      {!currentExercise && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-gray-950 to-transparent pt-8">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowFinishConfirm(true)}
            className={`w-full rounded-2xl py-4 font-bold text-lg flex items-center justify-center gap-3 shadow-xl ${
              currentStats.completionPercent === 100
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse'
                : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
            }`}
          >
            {currentStats.completionPercent === 100 ? (
              <>
                <Trophy className="w-6 h-6" />
                Получить награду!
              </>
            ) : (
              <>
                <Flag className="w-6 h-6" />
                Завершить тренировку
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  )
}
