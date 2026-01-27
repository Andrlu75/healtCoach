import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Dumbbell, Play, CheckCircle2, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import api from '../../api/client'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
} as const

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

export default function WorkoutDetail() {
  const { id: workoutId } = useParams()
  const [searchParams] = useSearchParams()
  const assignmentId = searchParams.get('assignment')
  const navigate = useNavigate()

  const [workout, setWorkout] = useState<{ name: string; description: string | null } | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('pending')

  useEffect(() => {
    if (workoutId) {
      fetchWorkoutDetails()
    }
    if (assignmentId) {
      fetchAssignmentStatus()
    }
  }, [workoutId, assignmentId])

  const fetchAssignmentStatus = async () => {
    try {
      const { data } = await api.get(`/workouts/assignments/${assignmentId}/`)
      setStatus(data.status)
    } catch (error) {
      console.error('Error fetching assignment status:', error)
    }
  }

  const fetchWorkoutDetails = async () => {
    try {
      // Fetch workout info
      const { data: workoutData } = await api.get(`/workouts/fitdb/workouts/${workoutId}/`)
      setWorkout({
        name: workoutData.name,
        description: workoutData.description,
      })

      // Fetch workout exercises
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
    } catch (error) {
      console.error('Error fetching workout details:', error)
    } finally {
      setLoading(false)
    }
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

  const totalTime = exercises.reduce((acc, ex) => {
    return acc + (ex.sets * 45) + (ex.sets * ex.rest_seconds)
  }, 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {/* Header */}
      <button
        onClick={() => navigate('/workouts')}
        className="flex items-center gap-2 text-blue-500 mb-4 -ml-1"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Назад</span>
      </button>

      {/* Workout Info */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {status === 'completed' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Выполнено
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{workout?.name}</h1>
        {workout?.description && (
          <p className="text-gray-500 dark:text-gray-400 mt-2">{workout.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Dumbbell className="w-4 h-4" />
            <span className="text-xs">Упражнений</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{exercises.length}</p>
        </div>
        <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Примерно</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(totalTime / 60)} мин</p>
        </div>
      </div>

      {/* Exercise List */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 px-1">Программа</h2>
        <motion.div
          className="space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {exercises.map((ex, index) => (
            <motion.div
              key={ex.id}
              variants={itemVariants}
              className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 font-semibold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">{ex.exercise.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ex.exercise.muscle_group && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getMuscleGroupColor(ex.exercise.muscle_group)}`}>
                        {ex.exercise.muscle_group}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {ex.sets} × {ex.reps}
                    </span>
                    {ex.weight_kg && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        · {ex.weight_kg} кг
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Start Button */}
      {status !== 'completed' && assignmentId && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto">
          <button
            onClick={() => navigate(`/workouts/${workoutId}/run?assignment=${assignmentId}`)}
            className="w-full bg-blue-500 text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform"
          >
            <Play className="w-5 h-5" fill="white" />
            Начать тренировку
          </button>
        </div>
      )}
    </div>
  )
}
