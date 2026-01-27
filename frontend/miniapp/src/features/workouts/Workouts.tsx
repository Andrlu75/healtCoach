import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, ChevronRight, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import api from '../../api/client'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
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

interface WorkoutAssignment {
  id: string
  status: string
  due_date: string | null
  notes: string | null
  workout_id: string
  workout_name: string
  exercises_count: number
}

export default function Workouts() {
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAssignments()
  }, [])

  const fetchAssignments = async () => {
    try {
      const { data } = await api.get('/workouts/assignments/')
      const assignmentsList = data.results || data

      // Get workout details for each assignment
      const assignmentsWithDetails = await Promise.all(
        assignmentsList.map(async (assignment: any) => {
          const workoutId = String(assignment.workout_id || assignment.workout)
          let workoutName = 'Тренировка'
          let exercisesCount = 0

          try {
            const { data: workout } = await api.get(`/workouts/fitdb/workouts/${workoutId}/`)
            workoutName = workout.name
          } catch {
            // Use default
          }

          try {
            const { data: exercises } = await api.get('/workouts/fitdb/workout-exercises/', {
              params: { workout_id: workoutId }
            })
            exercisesCount = Array.isArray(exercises) ? exercises.length : (exercises.results?.length || 0)
          } catch {
            // Use default
          }

          return {
            id: String(assignment.id),
            status: assignment.status,
            due_date: assignment.due_date,
            notes: assignment.notes,
            workout_id: workoutId,
            workout_name: workoutName,
            exercises_count: exercisesCount,
          }
        })
      )

      setAssignments(assignmentsWithDetails)
    } catch (error) {
      console.error('Error fetching assignments:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Выполнено
          </span>
        )
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            В процессе
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium">
            Ожидает
          </span>
        )
    }
  }

  const pendingWorkouts = assignments.filter(a => a.status === 'pending' || a.status === 'active')
  const completedWorkouts = assignments.filter(a => a.status === 'completed')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm">Загрузка тренировок...</p>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Мои тренировки</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Назначенные программы</p>
      </div>

      {/* Active Workouts Section */}
      {pendingWorkouts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 px-1">
            Активные · {pendingWorkouts.length}
          </h2>
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {pendingWorkouts.map((assignment) => (
              <motion.div
                key={assignment.id}
                variants={itemVariants}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/workouts/${assignment.workout_id}?assignment=${assignment.id}`)}
                className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                      <Dumbbell className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{assignment.workout_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {assignment.exercises_count} упражнений
                      </p>
                      {assignment.due_date && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          До {format(new Date(assignment.due_date), 'd MMMM', { locale: ru })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(assignment.status)}
                    <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Completed Workouts Section */}
      {completedWorkouts.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 px-1">
            Выполненные · {completedWorkouts.length}
          </h2>
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {completedWorkouts.map((assignment) => (
              <motion.div
                key={assignment.id}
                variants={itemVariants}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/workouts/${assignment.workout_id}?assignment=${assignment.id}`)}
                className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 opacity-75 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-700 dark:text-gray-300">{assignment.workout_name}</h3>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {assignment.exercises_count} упражнений
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-200 dark:text-gray-700" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Empty State */}
      {assignments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Dumbbell className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Нет тренировок</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 text-center max-w-xs">
            Ваш тренер пока не назначил вам программу тренировок
          </p>
        </div>
      )}
    </div>
  )
}
