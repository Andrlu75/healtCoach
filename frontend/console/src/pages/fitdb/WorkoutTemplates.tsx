import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Dumbbell,
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  ListChecks,
  FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { workoutsApi, workoutExercisesApi } from '@/api/fitdb';

interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  createdAt: string;
}

const WorkoutTemplates = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const data = await workoutsApi.list({ ordering: '-created_at' });

      // Exercise count is now included in the response - no extra API calls needed
      const mapped: TemplateListItem[] = (data || []).map((w: any) => ({
        id: String(w.id),
        name: w.name,
        description: w.description,
        exerciseCount: w.exercise_count || 0,
        createdAt: w.created_at,
      }));

      setTemplates(mapped);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить шаблоны',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Delete exercises first
      await workoutExercisesApi.deleteByWorkout(id);
      // Then delete workout
      await workoutsApi.delete(id);

      setTemplates(templates.filter(t => t.id !== id));
      toast({
        title: 'Шаблон удалён',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить шаблон',
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
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/fitdb')} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">Шаблоны тренировок</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">{templates.length} шаблонов</p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/fitdb/templates/new')} className="shadow-glow shrink-0">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Создать шаблон</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {templates.length > 0 ? (
          <div className="space-y-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="gradient-card border-border/50 shadow-card hover:border-primary/30 transition-all animate-fade-in"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-base sm:text-lg text-foreground truncate">
                          {template.name}
                        </h3>
                        <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                          <FileText className="w-3 h-3 mr-1" />
                          Шаблон
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ListChecks className="w-4 h-4" />
                          {template.exerciseCount} упр.
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => navigate(`/fitdb/templates/${template.id}`)}
                        title="Редактировать"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
                        title="Удалить"
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
              Нет шаблонов тренировок
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Создайте типовые тренировки, которые можно быстро назначать клиентам
            </p>
            <Button onClick={() => navigate('/fitdb/templates/new')} className="shadow-glow">
              <Plus className="w-5 h-5 mr-2" />
              Создать шаблон
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default WorkoutTemplates;
