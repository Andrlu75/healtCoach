import { Dumbbell, Plus, Search } from 'lucide-react';

interface EmptyStateProps {
  hasFilters: boolean;
  onAddClick: () => void;
}

export function EmptyState({ hasFilters, onAddClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
        {hasFilters ? (
          <Search className="w-10 h-10 text-gray-400" />
        ) : (
          <Dumbbell className="w-10 h-10 text-gray-400" />
        )}
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
        {hasFilters ? 'Упражнения не найдены' : 'База упражнений пуста'}
      </h3>

      <p className="text-gray-500 text-center mb-6 max-w-sm">
        {hasFilters
          ? 'Попробуйте изменить параметры поиска или сбросить фильтры'
          : 'Добавьте первое упражнение, чтобы начать создавать тренировки'}
      </p>

      {!hasFilters && (
        <button
          onClick={onAddClick}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          <Plus className="w-5 h-5" />
          Добавить упражнение
        </button>
      )}
    </div>
  );
}
