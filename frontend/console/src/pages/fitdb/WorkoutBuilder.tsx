import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Exercise, MuscleGroup, ExerciseCategory } from '@/types/exercise';
import { muscleGroupLabels, muscleGroupIcons } from '@/types/exercise';
import type { WorkoutExercise } from '@/types/workout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  GripVertical,
  Dumbbell,
  Loader2,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exercisesApi, workoutsApi, workoutExercisesApi } from '@/api/fitdb';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WorkoutItem extends WorkoutExercise {
  exercise: Exercise;
}

const WorkoutBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workoutItems, setWorkoutItems] = useState<WorkoutItem[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);

  useEffect(() => {
    fetchExercises();
    if (id) {
      fetchWorkout(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchExercises = async () => {
    try {
      const data = await exercisesApi.list({ ordering: 'name' });
      setExercises((data || []).map((e: any) => ({
        id: String(e.id),
        name: e.name,
        description: e.description,
        muscleGroup: (e.muscleGroup || 'chest') as MuscleGroup,
        category: (e.category || 'strength') as ExerciseCategory,
        difficulty: (e.difficulty || 'intermediate') as Exercise['difficulty'],
        equipment: e.equipment || undefined,
        imageUrl: e.imageUrl || undefined,
      })));
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  const fetchWorkout = async (workoutId: string) => {
    try {
      const workout = await workoutsApi.get(workoutId);
      setName(workout.name);
      setDescription(workout.description || '');

      const items = await workoutExercisesApi.list(workoutId);

      // Fetch exercise details for each workout exercise
      const exerciseIds: string[] = Array.from(new Set((items || []).map((item: any) => String(item.exercise_id || item.exercise))));
      const exerciseDetails: Record<string, any> = {};

      await Promise.all(exerciseIds.map(async (exerciseId) => {
        try {
          const exercise = await exercisesApi.get(exerciseId);
          exerciseDetails[exerciseId] = exercise;
        } catch {
          // Ignore errors
        }
      }));

      const mappedItems: WorkoutItem[] = (items || []).map((item: any) => {
        const exerciseId = String(item.exercise_id || item.exercise);
        const exerciseData = exerciseDetails[exerciseId] || {};
        return {
          id: String(item.id),
          exerciseId,
          sets: item.sets,
          reps: item.reps,
          restSeconds: item.rest_seconds,
          weightKg: item.weight_kg || undefined,
          notes: item.notes || undefined,
          orderIndex: item.order_index || item.order || 0,
          exercise: {
            id: exerciseId,
            name: exerciseData.name || 'Упражнение',
            description: exerciseData.description || '',
            muscleGroup: (exerciseData.muscleGroup || 'chest') as MuscleGroup,
            category: (exerciseData.category || 'strength') as ExerciseCategory,
            difficulty: (exerciseData.difficulty || 'intermediate') as Exercise['difficulty'],
            equipment: exerciseData.equipment || undefined,
            imageUrl: exerciseData.imageUrl || undefined,
          },
        };
      });

      // Sort by order_index
      mappedItems.sort((a, b) => a.orderIndex - b.orderIndex);

      setWorkoutItems(mappedItems);
    } catch (error) {
      console.error('Error fetching workout:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить тренировку',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addExercise = (exercise: Exercise) => {
    const newItem: WorkoutItem = {
      id: `temp-${Date.now()}`,
      exerciseId: exercise.id,
      sets: 3,
      reps: 10,
      restSeconds: 60,
      orderIndex: workoutItems.length,
      exercise,
    };
    setWorkoutItems([...workoutItems, newItem]);
    setSelectorOpen(false);
    setSearchQuery('');
    setSelectedMuscle(null);
  };

  const updateItem = (itemId: string, updates: Partial<WorkoutItem>) => {
    setWorkoutItems(items =>
      items.map(item => item.id === itemId ? { ...item, ...updates } : item)
    );
  };

  const removeItem = (itemId: string) => {
    setWorkoutItems(items => items.filter(item => item.id !== itemId));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...workoutItems];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newItems.length) return;
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setWorkoutItems(newItems.map((item, i) => ({ ...item, orderIndex: i })));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название тренировки',
        variant: 'destructive',
      });
      return;
    }

    if (workoutItems.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Добавьте хотя бы одно упражнение',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      let workoutId = id;

      if (id) {
        // Update existing
        await workoutsApi.update(id, { name, description: description || undefined });

        // Delete old exercises
        await workoutExercisesApi.deleteByWorkout(id);
      } else {
        // Create new
        const data = await workoutsApi.create({ name, description: description || undefined });
        workoutId = String(data.id);
      }

      // Insert exercises
      const exerciseInserts = workoutItems.map((item, index) => ({
        workout_id: workoutId!,
        exercise_id: item.exerciseId,
        sets: item.sets,
        reps: item.reps,
        rest_seconds: item.restSeconds,
        weight_kg: item.weightKg,
        notes: item.notes,
        order_index: index,
      }));

      // Insert exercises one by one or in bulk
      for (const exerciseData of exerciseInserts) {
        await workoutExercisesApi.create(exerciseData);
      }

      toast({
        title: 'Успешно!',
        description: id ? 'Тренировка обновлена' : 'Тренировка создана',
      });

      navigate('/fitdb/workouts');
    } catch (error) {
      console.error('Error saving workout:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить тренировку',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredExercises = exercises.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
    const notAdded = !workoutItems.some(item => item.exerciseId === e.id);
    return matchesSearch && matchesMuscle && notAdded;
  });

  const totalTime = workoutItems.reduce((acc, item) => {
    return acc + (item.sets * 45) + (item.sets * item.restSeconds);
  }, 0);

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
              <Button variant="ghost" size="icon" onClick={() => navigate('/fitdb/workouts')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {id ? 'Редактирование' : 'Новая тренировка'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {workoutItems.length} упражнений • ~{Math.round(totalTime / 60)} мин
                </p>
              </div>
            </div>
            
            <Button onClick={handleSave} disabled={saving} className="shadow-glow">
              {saving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              Сохранить
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Workout Info */}
        <Card className="mb-6 gradient-card border-border/50 shadow-card">
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Название</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Грудь + Трицепс"
                className="mt-1 bg-muted border-border/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Описание (опционально)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Цель тренировки, заметки..."
                className="mt-1 bg-muted border-border/50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Exercise List */}
        <div className="space-y-3 mb-6">
          {workoutItems.map((item, index) => (
            <Card key={item.id} className="gradient-card border-border/50 shadow-card animate-fade-in">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Drag Handle & Image */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                      {item.exercise.imageUrl ? (
                        <img src={item.exercise.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{muscleGroupIcons[item.exercise.muscleGroup]}</span>
                      )}
                    </div>
                  </div>

                  {/* Exercise Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{item.exercise.name}</h3>
                        <p className="text-sm text-muted-foreground">{muscleGroupLabels[item.exercise.muscleGroup]}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Parameters */}
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Подходы</label>
                        <Input
                          type="number"
                          min={1}
                          value={item.sets}
                          onChange={(e) => updateItem(item.id, { sets: parseInt(e.target.value) || 1 })}
                          className="h-9 bg-muted border-border/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Повторы</label>
                        <Input
                          type="number"
                          min={1}
                          value={item.reps}
                          onChange={(e) => updateItem(item.id, { reps: parseInt(e.target.value) || 1 })}
                          className="h-9 bg-muted border-border/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Вес (кг)</label>
                        <Input
                          type="number"
                          min={0}
                          step={2.5}
                          value={item.weightKg || ''}
                          onChange={(e) => updateItem(item.id, { weightKg: parseFloat(e.target.value) || undefined })}
                          placeholder="—"
                          className="h-9 bg-muted border-border/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Отдых</label>
                        <Input
                          type="number"
                          min={0}
                          step={15}
                          value={item.restSeconds}
                          onChange={(e) => updateItem(item.id, { restSeconds: parseInt(e.target.value) || 0 })}
                          className="h-9 bg-muted border-border/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add Exercise Button */}
        <Button
          variant="outline"
          className="w-full h-14 border-dashed border-2 hover:border-primary/50"
          onClick={() => setSelectorOpen(true)}
        >
          <Plus className="w-5 h-5 mr-2" />
          Добавить упражнение
        </Button>

        {/* Empty State */}
        {workoutItems.length === 0 && (
          <div className="text-center py-12">
            <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Добавьте упражнения из базы</p>
          </div>
        )}
      </main>

      {/* Exercise Selector Dialog */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Выберите упражнение</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted border-border/50"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(['chest', 'back', 'shoulders', 'legs', 'abs'] as MuscleGroup[]).map(muscle => (
                <Badge
                  key={muscle}
                  variant={selectedMuscle === muscle ? 'default' : 'secondary'}
                  className="cursor-pointer"
                  onClick={() => setSelectedMuscle(selectedMuscle === muscle ? null : muscle)}
                >
                  {muscleGroupLabels[muscle]}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mt-4">
            {filteredExercises.length > 0 ? (
              filteredExercises.map(exercise => (
                <button
                  key={exercise.id}
                  onClick={() => addExercise(exercise)}
                  className="w-full p-3 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 hover:border-primary/30 transition-all text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                    {muscleGroupIcons[exercise.muscleGroup]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{exercise.name}</p>
                    <p className="text-sm text-muted-foreground">{muscleGroupLabels[exercise.muscleGroup]}</p>
                  </div>
                  <Plus className="w-5 h-5 text-primary" />
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {exercises.length === 0 ? 'База упражнений пуста' : 'Упражнения не найдены'}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkoutBuilder;
