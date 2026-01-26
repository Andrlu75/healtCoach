import { Search } from 'lucide-react';
import type { MuscleGroup, ExerciseCategory } from '../../types/fitdb';
import { muscleGroupLabels, categoryLabels } from '../../types/fitdb';

interface ExerciseFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedMuscleGroup: MuscleGroup | null;
  onMuscleGroupChange: (group: MuscleGroup | null) => void;
  selectedCategory: ExerciseCategory | null;
  onCategoryChange: (category: ExerciseCategory | null) => void;
}

export function ExerciseFilters({
  searchQuery,
  onSearchChange,
  selectedMuscleGroup,
  onMuscleGroupChange,
  selectedCategory,
  onCategoryChange,
}: ExerciseFiltersProps) {
  const muscleGroups: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'abs', 'cardio'];
  const categories: ExerciseCategory[] = ['strength', 'cardio', 'flexibility', 'plyometric'];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск упражнений..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Muscle Groups */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Группа мышц</h3>
        <div className="flex flex-wrap gap-2">
          {muscleGroups.map((group) => (
            <button
              key={group}
              onClick={() => onMuscleGroupChange(selectedMuscleGroup === group ? null : group)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedMuscleGroup === group
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {muscleGroupLabels[group]}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Категория</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(selectedCategory === category ? null : category)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
