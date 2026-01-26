import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { MuscleGroup, ExerciseCategory } from '@/types/exercise';
import { muscleGroupLabels, categoryLabels } from '@/types/exercise';

interface ExerciseFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedMuscleGroup: MuscleGroup | null;
  onMuscleGroupChange: (value: MuscleGroup | null) => void;
  selectedCategory: ExerciseCategory | null;
  onCategoryChange: (value: ExerciseCategory | null) => void;
}

export const ExerciseFilters = ({
  searchQuery,
  onSearchChange,
  selectedMuscleGroup,
  onMuscleGroupChange,
  selectedCategory,
  onCategoryChange,
}: ExerciseFiltersProps) => {
  const muscleGroups = Object.entries(muscleGroupLabels) as [MuscleGroup, string][];
  const categories = Object.entries(categoryLabels) as [ExerciseCategory, string][];

  const hasFilters = searchQuery || selectedMuscleGroup || selectedCategory;

  const clearFilters = () => {
    onSearchChange('');
    onMuscleGroupChange(null);
    onCategoryChange(null);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск упражнений..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Muscle Groups */}
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">Группа мышц</label>
        <div className="flex flex-wrap gap-1.5">
          {muscleGroups.map(([key, label]) => (
            <Button
              key={key}
              variant={selectedMuscleGroup === key ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => onMuscleGroupChange(selectedMuscleGroup === key ? null : key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">Категория</label>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(([key, label]) => (
            <Button
              key={key}
              variant={selectedCategory === key ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => onCategoryChange(selectedCategory === key ? null : key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
          <X className="w-4 h-4 mr-1" />
          Сбросить фильтры
        </Button>
      )}
    </div>
  );
};
