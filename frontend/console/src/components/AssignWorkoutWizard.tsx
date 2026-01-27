import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  Dumbbell,
  Pencil,
  ChevronRight,
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Search,
  AlertCircle,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  workoutsApi,
  workoutExercisesApi,
  exercisesApi,
  assignmentsApi,
  type Workout,
} from '@/api/fitdb';
import type { Exercise as ExerciseType, MuscleGroup } from '@/types/exercise';
import { muscleGroupLabels, muscleGroupIcons } from '@/types/exercise';
import type { WorkoutExercise } from '@/types/workout';

interface AssignWorkoutWizardProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type WizardStep = 'select-mode' | 'select-template' | 'customize' | 'assign';
type AssignMode = 'direct' | 'from-template';

interface WorkoutItem extends WorkoutExercise {
  exercise: ExerciseType;
}

export const AssignWorkoutWizard = ({
  clientId,
  clientName,
  open,
  onOpenChange,
  onSuccess,
}: AssignWorkoutWizardProps) => {
  const { toast } = useToast();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('select-mode');
  const [mode, setMode] = useState<AssignMode | null>(null);

  // Templates
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  // Exercises for customization
  const [workoutItems, setWorkoutItems] = useState<WorkoutItem[]>([]);
  const [exercises, setExercises] = useState<ExerciseType[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Assignment
  const [workoutName, setWorkoutName] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState(false);

  useEffect(() => {
    if (open) {
      resetWizard();
      fetchWorkouts();
    }
  }, [open]);

  const resetWizard = () => {
    setStep('select-mode');
    setMode(null);
    setSelectedWorkoutId('');
    setSelectedWorkout(null);
    setWorkoutItems([]);
    setWorkoutName('');
    setDueDate(undefined);
    setNotes('');
    setSelectorOpen(false);
    setSearchQuery('');
    setSelectedMuscle(null);
    setDateError(false);
  };

  const fetchWorkouts = async () => {
    setLoadingWorkouts(true);
    try {
      const data = await workoutsApi.list({ ordering: 'name' });
      setWorkouts(
        (data || []).map((w: any) => ({
          id: String(w.id),
          name: w.name,
          description: w.description,
          is_template: true,
          created_at: w.created_at,
          updated_at: w.updated_at,
        }))
      );
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoadingWorkouts(false);
    }
  };

  // Server-side search for exercises
  const fetchExercises = useCallback(async (search?: string) => {
    try {
      setSearchLoading(true);
      const data = await exercisesApi.list({
        ordering: 'name',
        search: search || undefined
      });
      setExercises(
        (data || []).map((e: any) => ({
          id: String(e.id),
          name: e.name,
          description: e.description || '',
          muscleGroups: e.muscleGroups || ['chest'],
          category: e.category,
          difficulty: e.difficulty,
          equipment: e.equipment || undefined,
          imageUrl: e.imageUrl || undefined,
        }))
      );
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Load exercises when selector opens or search changes
  useEffect(() => {
    if (selectorOpen) {
      const timer = setTimeout(() => {
        fetchExercises(searchQuery);
      }, searchQuery ? 300 : 0);
      return () => clearTimeout(timer);
    }
  }, [selectorOpen, searchQuery, fetchExercises]);

  const handleModeSelect = (selectedMode: AssignMode) => {
    setMode(selectedMode);
    setStep('select-template');
  };

  const handleTemplateSelect = async (workoutId: string) => {
    setSelectedWorkoutId(workoutId);
    const workout = workouts.find((w) => w.id === workoutId);
    setSelectedWorkout(workout || null);
    setWorkoutName(workout ? `${workout.name} - ${clientName}` : '');

    if (mode === 'from-template') {
      // Load exercises for customization
      setLoadingExercises(true);
      try {
        const items = await workoutExercisesApi.list(workoutId);
        const mappedItems: WorkoutItem[] = await Promise.all(
          items.map(async (item: any) => {
            let exercise = exercises.find((e) => e.id === String(item.exercise_id));
            if (!exercise) {
              try {
                const ex = await exercisesApi.get(String(item.exercise_id));
                exercise = {
                  id: String(ex.id),
                  name: ex.name,
                  description: ex.description || '',
                  muscleGroups: ex.muscleGroups || ['chest'],
                  category: ex.category,
                  difficulty: ex.difficulty,
                };
              } catch {
                exercise = {
                  id: String(item.exercise_id),
                  name: 'Упражнение',
                  description: '',
                  muscleGroups: ['chest'] as MuscleGroup[],
                  category: 'strength',
                  difficulty: 'intermediate',
                };
              }
            }
            return {
              id: `temp-${item.id}`,
              exerciseId: String(item.exercise_id),
              sets: item.sets,
              reps: item.reps,
              restSeconds: item.rest_seconds,
              weightKg: item.weight_kg || undefined,
              notes: item.notes || undefined,
              orderIndex: item.order_index,
              exercise,
            };
          })
        );
        setWorkoutItems(mappedItems.sort((a, b) => a.orderIndex - b.orderIndex));
        setStep('customize');
      } catch (error) {
        console.error('Error loading exercises:', error);
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить упражнения',
          variant: 'destructive',
        });
      } finally {
        setLoadingExercises(false);
      }
    } else {
      // Direct assignment
      setStep('assign');
    }
  };

  const addExercise = (exercise: ExerciseType) => {
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
    setWorkoutItems((items) =>
      items.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );
  };

  const removeItem = (itemId: string) => {
    setWorkoutItems((items) => items.filter((item) => item.id !== itemId));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...workoutItems];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newItems.length) return;
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setWorkoutItems(newItems.map((item, i) => ({ ...item, orderIndex: i })));
  };

  const handleAssign = async () => {
    // Validate required date
    if (!dueDate) {
      setDateError(true);
      return;
    }
    setDateError(false);

    setSaving(true);
    try {
      let workoutIdToAssign = selectedWorkoutId;

      if (mode === 'from-template') {
        // Clone template with customizations
        const exercisesToClone = workoutItems.map((item) => ({
          exercise_id: item.exerciseId,
          sets: item.sets,
          reps: item.reps,
          rest_seconds: item.restSeconds,
          weight_kg: item.weightKg,
          notes: item.notes || '',
        }));

        const cloned = await workoutsApi.clone(selectedWorkoutId, {
          name: workoutName || `${selectedWorkout?.name} - ${clientName}`,
          client_id: clientId,
          exercises: exercisesToClone,
        });
        workoutIdToAssign = String(cloned.id);
      }

      // Create assignment
      await assignmentsApi.create({
        workout_id: workoutIdToAssign,
        client_id: clientId,
        due_date: format(dueDate, 'yyyy-MM-dd'),
        notes: notes.trim() || undefined,
      });

      toast({ title: 'Тренировка назначена' });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning workout:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось назначить тренировку',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Server handles search, we only filter by muscle group and already added
  const filteredExercises = exercises.filter((e) => {
    const matchesMuscle = !selectedMuscle || e.muscleGroups?.includes(selectedMuscle);
    const notAdded = !workoutItems.some((item) => item.exerciseId === e.id);
    return matchesMuscle && notAdded;
  });

  const goBack = () => {
    if (step === 'assign' && mode === 'from-template') {
      setStep('customize');
    } else if (step === 'assign' || step === 'customize') {
      setStep('select-template');
    } else if (step === 'select-template') {
      setStep('select-mode');
      setMode(null);
      setSelectedWorkoutId('');
    }
  };

  // Step 1: Select mode
  if (step === 'select-mode') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Назначить тренировку</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground mb-4">
            Клиент: <span className="font-medium text-foreground">{clientName}</span>
          </p>

          <div className="grid grid-cols-1 gap-3">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleModeSelect('direct')}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Dumbbell className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Назначить готовую</h3>
                  <p className="text-sm text-muted-foreground">
                    Выбрать шаблон без изменений
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleModeSelect('from-template')}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Pencil className="w-6 h-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Создать из шаблона</h3>
                  <p className="text-sm text-muted-foreground">
                    Выбрать и адаптировать под клиента
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2: Select template
  if (step === 'select-template') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <DialogTitle>Выберите шаблон</DialogTitle>
            </div>
          </DialogHeader>

          {loadingWorkouts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : workouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Dumbbell className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Нет доступных шаблонов</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {workouts.map((workout) => (
                <button
                  key={workout.id}
                  onClick={() => handleTemplateSelect(workout.id)}
                  disabled={loadingExercises}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{workout.name}</p>
                    {workout.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {workout.description}
                      </p>
                    )}
                  </div>
                  {loadingExercises && selectedWorkoutId === workout.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Step 3: Customize exercises
  if (step === 'customize') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <DialogTitle>Редактирование тренировки</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {workoutItems.length} упражнений
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            {/* Workout name */}
            <div className="px-1">
              <Label>Название тренировки</Label>
              <Input
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                placeholder="Например: День ног для Ивана"
                className="mt-1"
              />
            </div>

            {/* Exercise list */}
            {workoutItems.map((item, index) => (
              <Card key={item.id} className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                      >
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                      </Button>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center text-lg">
                        {muscleGroupIcons[item.exercise.muscleGroups?.[0]] || '💪'}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-medium text-sm">{item.exercise.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {item.exercise.muscleGroups?.map(mg => muscleGroupLabels[mg]).join(', ') || ''}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Подходы</label>
                          <Input
                            type="number"
                            min={1}
                            value={item.sets}
                            onChange={(e) =>
                              updateItem(item.id, { sets: parseInt(e.target.value) || 1 })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Повторы</label>
                          <Input
                            type="number"
                            min={1}
                            value={item.reps}
                            onChange={(e) =>
                              updateItem(item.id, { reps: parseInt(e.target.value) || 1 })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Вес</label>
                          <Input
                            type="number"
                            min={0}
                            step={2.5}
                            value={item.weightKg || ''}
                            onChange={(e) =>
                              updateItem(item.id, {
                                weightKg: parseFloat(e.target.value) || undefined,
                              })
                            }
                            placeholder="—"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Отдых</label>
                          <Input
                            type="number"
                            min={0}
                            step={15}
                            value={item.restSeconds}
                            onChange={(e) =>
                              updateItem(item.id, {
                                restSeconds: parseInt(e.target.value) || 0,
                              })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setSelectorOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить упражнение
            </Button>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={goBack}>
              Назад
            </Button>
            <Button
              onClick={() => setStep('assign')}
              disabled={workoutItems.length === 0}
            >
              Далее
            </Button>
          </DialogFooter>

          {/* Exercise Selector Dialog */}
          <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
            <DialogContent className="sm:max-w-[400px] max-h-[70vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Добавить упражнение</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  {(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'abs', 'cardio'] as MuscleGroup[]).map(
                    (muscle) => (
                      <Badge
                        key={muscle}
                        variant={selectedMuscle === muscle ? 'default' : 'secondary'}
                        className="cursor-pointer text-xs"
                        onClick={() =>
                          setSelectedMuscle(selectedMuscle === muscle ? null : muscle)
                        }
                      >
                        {muscleGroupLabels[muscle]}
                      </Badge>
                    )
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 mt-3">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredExercises.length > 0 ? (
                  filteredExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      onClick={() => addExercise(exercise)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-sm">
                        {muscleGroupIcons[exercise.muscleGroups?.[0]] || '💪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.muscleGroups?.map(mg => muscleGroupLabels[mg]).join(', ') || ''}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-primary" />
                    </button>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-6">
                    {searchQuery ? 'Упражнения не найдены' : 'Начните вводить название'}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 4: Assignment settings
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <DialogTitle>Настройки назначения</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Тренировка</Label>
            <p className="font-medium text-foreground">
              {mode === 'from-template' ? workoutName : selectedWorkout?.name}
            </p>
            {mode === 'from-template' && (
              <p className="text-sm text-muted-foreground">
                {workoutItems.length} упражнений (персонализированная)
              </p>
            )}
          </div>

          <div>
            <Label>Дата тренировки *</Label>
            <DatePicker
              value={dueDate}
              onChange={(date) => {
                setDueDate(date);
                setDateError(false);
              }}
              placeholder="Выберите дату"
              className="mt-1"
            />
            {dateError && (
              <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" />
                Выберите дату тренировки
              </p>
            )}
          </div>

          <div>
            <Label>Заметки</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Дополнительные инструкции..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={goBack}>
            Назад
          </Button>
          <Button onClick={handleAssign} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Назначить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
