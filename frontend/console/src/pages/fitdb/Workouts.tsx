import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Dumbbell, 
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  Clock,
  ListChecks,
  History,
  Play
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { workoutsApi } from '@/api/fitdb';

interface WorkoutListItem {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  createdAt: string;
}

const Workouts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const data = await workoutsApi.list({ ordering: '-created_at' });

      // Exercise count is now included in the response - no extra API calls needed
      const workoutsWithCounts = (data || []).map((w: any) => ({
        id: String(w.id),
        name: w.name,
        description: w.description,
        exerciseCount: w.exercise_count || 0,
        createdAt: w.created_at,
      }));

      setWorkouts(workoutsWithCounts);
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await workoutsApi.delete(id);

      setWorkouts(workouts.filter(w => w.id !== id));
      toast({
        title: 'Тренировка удалена',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error deleting workout:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить тренировку',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Мои тренировки</h1>
                <p className="text-sm text-muted-foreground">{workouts.length} программ</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/fitdb/history')}>
                <History className="w-5 h-5 mr-2" />
                История
              </Button>
              <Button onClick={() => navigate('/fitdb/workouts/new')} className="shadow-glow">
                <Plus className="w-5 h-5 mr-2" />
                Создать
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {workouts.length > 0 ? (
          <div className="space-y-4">
            {workouts.map((workout) => (
              <Card 
                key={workout.id} 
                className="gradient-card border-border/50 shadow-card hover:border-primary/30 transition-all cursor-pointer animate-fade-in"
                onClick={() => navigate(`/workouts/${workout.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground mb-1">
                        {workout.name}
                      </h3>
                      {workout.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {workout.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ListChecks className="w-4 h-4" />
                          {workout.exerciseCount} упражнений
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(workout.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/workouts/${workout.id}/run`)}
                        className="shadow-glow"
                        disabled={workout.exerciseCount === 0}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Начать
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => navigate(`/workouts/${workout.id}`)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(workout.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
              <Dumbbell className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Нет сохранённых тренировок
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Создайте свою первую программу тренировок из упражнений в базе
            </p>
            <Button onClick={() => navigate('/fitdb/workouts/new')} className="shadow-glow">
              <Plus className="w-5 h-5 mr-2" />
              Создать тренировку
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Workouts;
