import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Dumbbell, Play, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { workoutsApi, workoutExercisesApi, assignmentsApi, exercisesApi } from '@/api/fitdb';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
} as const;

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
} as const;

interface Exercise {
  id: string;
  order_index: number;
  sets: number;
  reps: number;
  rest_seconds: number;
  weight_kg: number | null;
  exercise: {
    id: string;
    name: string;
    muscle_group: string;
    image_url: string | null;
  };
}

interface MiniAppWorkoutDetailProps {
  workoutId: string;
  assignmentId: string;
  onBack: () => void;
  onStartWorkout: () => void;
}

export const MiniAppWorkoutDetail = ({
  workoutId,
  assignmentId,
  onBack,
  onStartWorkout
}: MiniAppWorkoutDetailProps) => {
  const [workout, setWorkout] = useState<{ name: string; description: string | null } | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    fetchWorkoutDetails();
    fetchAssignmentStatus();
  }, [workoutId, assignmentId]);

  const fetchAssignmentStatus = async () => {
    try {
      const data = await assignmentsApi.list({ client_id: undefined });
      const assignment = data.find((a: any) => String(a.id) === assignmentId);
      if (assignment) setStatus(assignment.status);
    } catch (error) {
      console.error('Error fetching assignment status:', error);
    }
  };

  const fetchWorkoutDetails = async () => {
    try {
      // Fetch workout info
      const workoutData = await workoutsApi.get(workoutId);
      setWorkout({
        name: workoutData.name,
        description: workoutData.description,
      });

      // Fetch workout exercises - details are now included in the response
      const exercisesData = await workoutExercisesApi.list(workoutId);

      // Exercise details are now included in the response - no extra API calls needed
      const exercisesWithDetails = (exercisesData || []).map((we: any) => {
        const exerciseData = we.exercise || {};
        return {
          id: String(we.id),
          order_index: we.order_index,
          sets: we.sets,
          reps: we.reps,
          rest_seconds: we.rest_seconds,
          weight_kg: we.weight_kg,
          exercise: {
            id: String(we.exercise_id || exerciseData.id),
            name: exerciseData.name || 'Упражнение',
            muscle_group: exerciseData.muscle_group || '',
            image_url: null,
          },
        } as Exercise;
      });

      // Sort by order_index
      exercisesWithDetails.sort((a, b) => a.order_index - b.order_index);
      setExercises(exercisesWithDetails);
    } catch (error) {
      console.error('Error fetching workout details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMuscleGroupColor = (group: string) => {
    const colors: Record<string, string> = {
      'Chest': 'bg-red-100 text-red-600',
      'Back': 'bg-blue-100 text-blue-600',
      'Shoulders': 'bg-orange-100 text-orange-600',
      'Legs': 'bg-purple-100 text-purple-600',
      'Glutes': 'bg-pink-100 text-pink-600',
      'Arms': 'bg-green-100 text-green-600',
      'Abs': 'bg-yellow-100 text-yellow-600',
      'Cardio': 'bg-cyan-100 text-cyan-600',
      'Грудь': 'bg-red-100 text-red-600',
      'Спина': 'bg-blue-100 text-blue-600',
      'Плечи': 'bg-orange-100 text-orange-600',
      'Ноги': 'bg-purple-100 text-purple-600',
      'Ягодицы': 'bg-pink-100 text-pink-600',
      'Руки': 'bg-green-100 text-green-600',
      'Пресс': 'bg-yellow-100 text-yellow-600',
      'Кардио': 'bg-cyan-100 text-cyan-600',
    };
    return colors[group] || 'bg-gray-100 text-gray-600';
  };

  const totalTime = exercises.reduce((acc, ex) => {
    return acc + (ex.sets * 45) + (ex.sets * ex.rest_seconds);
  }, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-blue-500 mb-4 -ml-1"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Назад</span>
      </button>

      {/* Workout Info */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {status === 'completed' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Выполнено
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{workout?.name}</h1>
        {workout?.description && (
          <p className="text-gray-500 mt-2">{workout.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Dumbbell className="w-4 h-4" />
            <span className="text-xs">Упражнений</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{exercises.length}</p>
        </div>
        <div className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Примерно</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{Math.round(totalTime / 60)} мин</p>
        </div>
      </div>

      {/* Exercise List */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3 px-1">Программа</h2>
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
              className="bg-white rounded-2xl p-4 border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{ex.exercise.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ex.exercise.muscle_group && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getMuscleGroupColor(ex.exercise.muscle_group)}`}>
                        {ex.exercise.muscle_group}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {ex.sets} × {ex.reps}
                    </span>
                    {ex.weight_kg && (
                      <span className="text-xs text-gray-500">
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
      {status !== 'completed' && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto">
          <button
            onClick={onStartWorkout}
            className="w-full bg-blue-500 text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform"
          >
            <Play className="w-5 h-5" fill="white" />
            Начать тренировку
          </button>
        </div>
      )}
    </div>
  );
};

export default MiniAppWorkoutDetail;
