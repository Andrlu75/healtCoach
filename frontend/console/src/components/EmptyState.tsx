import { Button } from '@/components/ui/button';
import { Dumbbell, Plus, Search } from 'lucide-react';

interface EmptyStateProps {
  hasFilters: boolean;
  onAddClick: () => void;
}

export const EmptyState = ({ hasFilters, onAddClick }: EmptyStateProps) => {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
          <Search className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Упражнения не найдены
        </h3>
        <p className="text-muted-foreground max-w-sm">
          Попробуйте изменить параметры поиска или сбросить фильтры
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <Dumbbell className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        База упражнений пуста
      </h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        Добавьте своё первое упражнение, чтобы начать формировать базу тренировок
      </p>
      <Button onClick={onAddClick} className="shadow-glow">
        <Plus className="w-5 h-5 mr-2" />
        Добавить упражнение
      </Button>
    </div>
  );
};
