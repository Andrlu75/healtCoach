import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Exercise, MuscleGroup, ExerciseCategory } from '@/types/exercise';
import { ExerciseCard } from '@/components/ExerciseCard';
import { ExerciseFilters } from '@/components/ExerciseFilters';
import { ExerciseForm } from '@/components/ExerciseForm';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Plus, Dumbbell, Loader2, ClipboardList, Users, BarChart3, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exercisesApi } from '@/api/fitdb';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      const data = await exercisesApi.list({ ordering: '-created_at' });
      const mappedExercises: Exercise[] = data.map((e: any) => ({
        id: String(e.id),
        name: e.name,
        description: e.description || '',
        muscleGroup: e.muscleGroup as MuscleGroup,
        category: e.category as ExerciseCategory,
        difficulty: e.difficulty,
        equipment: e.equipment || undefined,
        imageUrl: e.imageUrl || undefined,
      }));
      setExercises(mappedExercises);
    } catch (error) {
      console.error('Error fetching exercises:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить упражнения',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      const matchesSearch =
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMuscle = !selectedMuscleGroup || exercise.muscleGroup === selectedMuscleGroup;
      const matchesCategory = !selectedCategory || exercise.category === selectedCategory;
      return matchesSearch && matchesMuscle && matchesCategory;
    });
  }, [exercises, searchQuery, selectedMuscleGroup, selectedCategory]);

  const handleSave = async (data: Omit<Exercise, 'id'> & { id?: string }, imageFile?: File) => {
    try {
      const exerciseData = {
        name: data.name,
        description: data.description,
        muscleGroup: data.muscleGroup,
        category: data.category,
        difficulty: data.difficulty,
        equipment: data.equipment || null,
        imageUrl: data.imageUrl || null,
      };

      if (data.id) {
        await exercisesApi.update(data.id, exerciseData);
        toast({
          title: 'Упражнение обновлено',
          description: `"${data.name}" успешно сохранено`,
        });
      } else {
        await exercisesApi.create(exerciseData);
        toast({
          title: 'Упражнение добавлено',
          description: `"${data.name}" добавлено в базу`,
        });
      }

      await fetchExercises();
      setEditingExercise(null);
    } catch (error) {
      console.error('Error saving exercise:', error);
      toast({
        title: 'Ошибка сохранения',
        description: 'Не удалось сохранить упражнение',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const exercise = exercises.find((e) => e.id === id);
      await exercisesApi.delete(id);
      await fetchExercises();
      toast({
        title: 'Упражнение удалено',
        description: `"${exercise?.name}" удалено из базы`,
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error deleting exercise:', error);
      toast({
        title: 'Ошибка удаления',
        description: 'Не удалось удалить упражнение',
        variant: 'destructive',
      });
    }
  };

  const handleAddNew = () => {
    setEditingExercise(null);
    setFormOpen(true);
  };

  const hasFilters = Boolean(searchQuery || selectedMuscleGroup || selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground">Загрузка упражнений...</p>
        </div>
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
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                <Dumbbell className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">FitBase</h1>
                <p className="text-sm text-muted-foreground">База упражнений</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/fitdb/dashboard')}
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                Дашборд
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/fitdb/templates')}
              >
                <FileText className="w-5 h-5 mr-2" />
                Шаблоны
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/fitdb/clients')}
              >
                <Users className="w-5 h-5 mr-2" />
                Клиенты
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/fitdb/workouts')}
              >
                <ClipboardList className="w-5 h-5 mr-2" />
                Тренировки
              </Button>
              <Button onClick={handleAddNew} className="shadow-glow">
                <Plus className="w-5 h-5 mr-2" />
                Добавить
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[300px,1fr] gap-6">
          {/* Sidebar Filters */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="bg-card rounded-xl border border-border/50 p-4 shadow-card">
              <h2 className="font-semibold text-foreground mb-4">Фильтры</h2>
              <ExerciseFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedMuscleGroup={selectedMuscleGroup}
                onMuscleGroupChange={setSelectedMuscleGroup}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
            </div>

            {/* Stats */}
            <div className="mt-4 bg-card rounded-xl border border-border/50 p-4 shadow-card">
              <p className="text-sm text-muted-foreground">
                Показано <span className="text-primary font-semibold">{filteredExercises.length}</span> из{' '}
                <span className="font-semibold text-foreground">{exercises.length}</span> упражнений
              </p>
            </div>
          </aside>

          {/* Exercise Grid */}
          <section>
            {filteredExercises.length > 0 ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredExercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <EmptyState hasFilters={hasFilters} onAddClick={handleAddNew} />
            )}
          </section>
        </div>
      </main>

      {/* Form Dialog */}
      <ExerciseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        exercise={editingExercise}
        onSave={handleSave}
      />
    </div>
  );
};

export default Index;
