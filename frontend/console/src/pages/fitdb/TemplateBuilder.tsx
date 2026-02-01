import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Exercise as ExerciseType, MuscleGroup, ExerciseCategory } from '@/types/exercise';
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
  Search,
  FileText
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
  exercise: ExerciseType;
}

const TemplateBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workoutItems, setWorkoutItems] = useState<WorkoutItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTemplate(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  // Server-side search for exercises
  const fetchExercises = useCallback(async (search?: string) => {
    try {
      setSearchLoading(true);
      const data = await exercisesApi.list({
        ordering: 'name',
        search: search || undefined
      });
      setExercises((data || []).map((e: any) => ({
        id: String(e.id),
        name: e.name,
        description: e.description || '',
        muscleGroups: e.muscleGroups || [e.muscleGroup || 'chest'],
        category: e.category as ExerciseCategory,
        difficulty: e.difficulty,
        equipment: e.equipment || undefined,
        imageUrl: e.imageUrl || undefined,
      })));
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Load exercises when dialog opens or search changes
  useEffect(() => {
    if (selectorOpen) {
      const timer = setTimeout(() => {
        fetchExercises(searchQuery);
      }, searchQuery ? 300 : 0);
      return () => clearTimeout(timer);
    }
  }, [selectorOpen, searchQuery, fetchExercises]);

  const fetchTemplate = async (templateId: string) => {
    try {
      const template = await workoutsApi.get(templateId);
      setName(template.name);
      setDescription(template.description || '');

      const items = await workoutExercisesApi.list(templateId);

      // Exercise details are now included in the response - no extra API calls needed
      const mappedItems: WorkoutItem[] = (items || []).map((item: any) => {
        const exerciseData = item.exercise || {};
        const category = (exerciseData.category || 'strength') as ExerciseCategory;
        return {
          id: String(item.id),
          exerciseId: String(item.exercise_id || exerciseData.id),
          sets: item.sets,
          reps: item.reps,
          restSeconds: item.rest_seconds,
          weightKg: item.weight_kg || undefined,
          durationSeconds: item.duration_seconds || undefined,
          distanceMeters: item.distance_meters || undefined,
          notes: item.notes || undefined,
          orderIndex: item.order_index,
          exercise: {
            id: String(item.exercise_id || exerciseData.id),
            name: exerciseData.name || 'Упражнение',
            description: exerciseData.description || '',
            muscleGroups: exerciseData.muscle_group ? [exerciseData.muscle_group] : ['chest'],
            category: category,
            difficulty: 'intermediate',
          },
        };
      });

      setWorkoutItems(mappedItems.sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (error) {
      console.error('Error fetching template:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить шаблон',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addExercise = (exercise: ExerciseType) => {
    // Категории с временными параметрами (не подходы/повторы)
    const timeBasedCategories = ['cardio', 'warmup', 'cooldown', 'flexibility'];
    const isTimeBased = timeBasedCategories.includes(exercise.category) || exercise.muscleGroups?.includes('cardio');
    const isCardio = exercise.category === 'cardio';

    const newItem: WorkoutItem = {
      id: `temp-${Date.now()}`,
      exerciseId: exercise.id,
      // Силовые параметры (по умолчанию для силовых и плиометрики)
      sets: isTimeBased ? 1 : 3,
      reps: isTimeBased ? 1 : 10,
      restSeconds: isTimeBased ? 0 : 60,
      // Временные параметры для кардио/разминки/заминки/растяжки
      durationSeconds: isTimeBased ? (isCardio ? 600 : 300) : undefined,
      distanceMeters: isCardio ? 1000 : undefined,
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
        description: 'Введите название шаблона',
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
      let templateId = id;

      if (id) {
        // Update existing
        await workoutsApi.update(id, { name, description: description || undefined });
        // Delete old exercises
        await workoutExercisesApi.deleteByWorkout(id);
      } else {
        // Create new
        const newWorkout = await workoutsApi.create({ name, description: description || undefined });
        templateId = String(newWorkout.id);
      }

      // Add exercises
      const exerciseInserts = workoutItems.map((item, index) => ({
        workout_id: templateId!,
        exercise_id: item.exerciseId,
        sets: item.sets,
        reps: item.reps,
        rest_seconds: item.restSeconds,
        weight_kg: item.weightKg || undefined,
        duration_seconds: item.durationSeconds || undefined,
        distance_meters: item.distanceMeters || undefined,
        notes: item.notes || undefined,
        order_index: index,
      }));

      await workoutExercisesApi.bulkCreate(exerciseInserts);

      toast({
        title: 'Успешно!',
        description: id ? 'Шаблон обновлён' : 'Шаблон создан',
      });

      navigate('/fitdb/templates');
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить шаблон',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Server handles search, we only filter by muscle group and already added
  const filteredExercises = exercises.filter(e => {
    const matchesMuscle = !selectedMuscle || e.muscleGroups?.includes(selectedMuscle);
    const notAdded = !workoutItems.some(item => item.exerciseId === e.id);
    return matchesMuscle && notAdded;
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
              <Button variant="ghost" size="icon" onClick={() => navigate('/fitdb/templates')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">
                    {id ? 'Редактирование шаблона' : 'Новый шаблон'}
                  </h1>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    <FileText className="w-3 h-3 mr-1" />
                    Шаблон
                  </Badge>
                </div>
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
        {/* Template Info */}
        <Card className="mb-6 gradient-card border-border/50 shadow-card">
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Название шаблона</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: День ног (зал)"
                className="mt-1 bg-muted border-border/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Описание</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Типовая тренировка для..."
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
                        <span className="text-2xl">{muscleGroupIcons[item.exercise.muscleGroups?.[0]] || '💪'}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{item.exercise.name}</h3>
                        <p className="text-sm text-muted-foreground">{item.exercise.muscleGroups?.map(mg => muscleGroupLabels[mg]).join(', ') || ''}</p>
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

                    {/* Parameters - разные для временных (кардио/разминка/заминка/растяжка) и силовых */}
                    {(() => {
                      const timeBasedCategories = ['cardio', 'warmup', 'cooldown', 'flexibility'];
                      const isTimeBased = timeBasedCategories.includes(item.exercise.category) || item.exercise.muscleGroups?.includes('cardio');
                      const isCardio = item.exercise.category === 'cardio';

                      if (isTimeBased) {
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Время (мин)</label>
                              <Input
                                type="number"
                                min={1}
                                value={item.durationSeconds ? Math.round(item.durationSeconds / 60) : ''}
                                onChange={(e) => updateItem(item.id, { durationSeconds: (parseInt(e.target.value) || 0) * 60 })}
                                placeholder="10"
                                className="h-9 bg-muted border-border/50"
                              />
                            </div>
                            {isCardio && (
                              <div>
                                <label className="text-xs text-muted-foreground">Дистанция (км)</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  value={item.distanceMeters ? (item.distanceMeters / 1000).toFixed(1) : ''}
                                  onChange={(e) => updateItem(item.id, { distanceMeters: (parseFloat(e.target.value) || 0) * 1000 })}
                                  placeholder="1.0"
                                  className="h-9 bg-muted border-border/50"
                                />
                              </div>
                            )}
                            <div>
                              <label className="text-xs text-muted-foreground">Отдых (сек)</label>
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
                        );
                      }
                      return (
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
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          variant="outline"
          className="w-full h-14 border-dashed border-2 hover:border-primary/50"
          onClick={() => setSelectorOpen(true)}
        >
          <Plus className="w-5 h-5 mr-2" />
          Добавить упражнение
        </Button>

        {workoutItems.length === 0 && (
          <div className="text-center py-12">
            <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Добавьте упражнения для шаблона</p>
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
                className="pl-9 pr-9 bg-muted border-border/50"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'abs', 'cardio'] as MuscleGroup[]).map(muscle => (
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

          <div className={`flex-1 overflow-y-auto space-y-2 mt-4 transition-opacity ${searchLoading ? 'opacity-50' : ''}`}>
            {filteredExercises.length > 0 ? (
              filteredExercises.map(exercise => (
                <button
                  key={exercise.id}
                  onClick={() => addExercise(exercise)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {exercise.imageUrl ? (
                      <img src={exercise.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-xl">{muscleGroupIcons[exercise.muscleGroups?.[0]] || '💪'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{exercise.name}</p>
                    <p className="text-sm text-muted-foreground">{exercise.muscleGroups?.map(mg => muscleGroupLabels[mg]).join(', ') || ''}</p>
                  </div>
                  <Plus className="w-5 h-5 text-primary" />
                </button>
              ))
            ) : !searchLoading ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery ? 'Упражнения не найдены' : 'Начните вводить название'}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateBuilder;
