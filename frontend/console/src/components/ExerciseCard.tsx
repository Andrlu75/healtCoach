import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Dumbbell } from 'lucide-react';
import type { Exercise } from '@/types/exercise';
import { muscleGroupLabels as mgLabels, categoryLabels as catLabels, difficultyLabels as diffLabels } from '@/types/exercise';

interface ExerciseCardProps {
  exercise: Exercise;
  onEdit: (exercise: Exercise) => void;
  onDelete: (id: string) => void;
}

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
};

export const ExerciseCard = ({ exercise, onEdit, onDelete }: ExerciseCardProps) => {
  return (
    <Card className="gradient-card border-border/50 shadow-card hover:border-primary/30 transition-all animate-fade-in overflow-hidden group">
      {/* Image */}
      <div className="relative h-40 bg-muted overflow-hidden">
        {exercise.imageUrl ? (
          <img
            src={exercise.imageUrl}
            alt={exercise.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <Dumbbell className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Difficulty badge */}
        <Badge className={`absolute top-2 right-2 ${difficultyColors[exercise.difficulty]}`}>
          {diffLabels[exercise.difficulty]}
        </Badge>
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{exercise.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{exercise.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {exercise.muscleGroups.map((mg) => (
            <Badge key={mg} variant="secondary" className="text-xs">
              {mgLabels[mg]}
            </Badge>
          ))}
          <Badge variant="outline" className="text-xs">
            {catLabels[exercise.category]}
          </Badge>
          {exercise.equipment && (
            <Badge variant="outline" className="text-xs">
              {exercise.equipment}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(exercise)}
          >
            <Pencil className="w-4 h-4 mr-1" />
            Изменить
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="shrink-0"
            onClick={() => onDelete(exercise.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
