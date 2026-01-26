import type { FitdbExercise } from '../../types/fitdb';
import { muscleGroupLabels, categoryLabels, difficultyLabels, muscleGroupIcons } from '../../types/fitdb';
import { Pencil, Trash2, Dumbbell } from 'lucide-react';

interface ExerciseCardProps {
  exercise: FitdbExercise;
  onEdit: (exercise: FitdbExercise) => void;
  onDelete: (id: string) => void;
}

const difficultyColors = {
  beginner: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  intermediate: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  advanced: 'bg-rose-500/20 text-rose-600 border-rose-500/30',
};

export function ExerciseCard({ exercise, onEdit, onDelete }: ExerciseCardProps) {
  return (
    <div className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-300 overflow-hidden">
      {/* Image */}
      {exercise.imageUrl ? (
        <div className="aspect-video overflow-hidden">
          <img
            src={exercise.imageUrl}
            alt={exercise.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      ) : (
        <div className="aspect-video bg-gray-50 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl">
            {muscleGroupIcons[exercise.muscleGroup]}
          </div>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
              {exercise.name}
            </h3>
            <p className="text-sm text-gray-500">
              {muscleGroupLabels[exercise.muscleGroup]}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {exercise.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
            {categoryLabels[exercise.category]}
          </span>
          <span className={`px-2 py-1 rounded text-xs border ${difficultyColors[exercise.difficulty]}`}>
            {difficultyLabels[exercise.difficulty]}
          </span>
        </div>

        {exercise.equipment && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Dumbbell className="w-4 h-4" />
            <span>{exercise.equipment}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onEdit(exercise)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            <Pencil className="w-4 h-4" />
            Изменить
          </button>
          <button
            onClick={() => onDelete(exercise.id)}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
