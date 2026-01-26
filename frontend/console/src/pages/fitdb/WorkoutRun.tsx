import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Exercise, MuscleGroup, ExerciseCategory } from '@/types/exercise';
import { muscleGroupLabels, muscleGroupIcons } from '@/types/exercise';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  SkipForward,
  RotateCcw,
  Check,
  Dumbbell,
  Loader2,
  Volume2,
  VolumeX,
  Minus,
  Plus,
  List,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WorkoutExerciseItem {
  id: string;
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg?: number;
  notes?: string;
  orderIndex: number;
  exercise: Exercise;
}

type ViewMode = 'list' | 'exercise';
type TimerState = 'idle' | 'working' | 'resting';

const WorkoutRun = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState<WorkoutExerciseItem[]>([]);
  
  // New: track completed exercises by their id
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  
  const [currentSet, setCurrentSet] = useState(1);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentWeight, setCurrentWeight] = useState<number | undefined>(undefined);
  const [currentReps, setCurrentReps] = useState<number>(10);
  
  // Session tracking
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedExercise = exercises.find(e => e.id === selectedExerciseId);
  const completedCount = completedExercises.size;
  const totalExercises = exercises.length;
  const overallProgress = totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0;
  const isWorkoutComplete = completedCount === totalExercises && totalExercises > 0;

  const createSession = async (workoutId: string) => {
    try {
      startTimeRef.current = new Date();
      const { data, error } = await supabase
        .from('workout_sessions')
        .insert({ workout_id: workoutId })
        .select('id')
        .single();
      
      if (error) throw error;
      setSessionId(data.id);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const logExerciseSet = async (exerciseId: string, setNumber: number, reps: number, weightKg?: number) => {
    if (!sessionId) return;
    
    try {
      await supabase.from('exercise_logs').insert({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: setNumber,
        reps_completed: reps,
        weight_kg: weightKg || null,
      });
    } catch (error) {
      console.error('Error logging exercise:', error);
    }
  };

  const completeSession = async () => {
    if (!sessionId || !startTimeRef.current) return;
    
    try {
      const duration = Math.round((new Date().getTime() - startTimeRef.current.getTime()) / 1000);
      await supabase
        .from('workout_sessions')
        .update({
          completed_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleSlbsOTqwYNXJHeq1uPZl2kvfp+1wqpuQl2IrsTAklQ1a5u3yqljMFGNssTHnmIxWZKwyLBgJlSdvNjWmU8raqbI0blvNFaWt9LUpmIyV5a42MqTUzZlnLzXz5xVNGKbu9jPlVQ0Y5u82M6WVTRjm7vYzpZVNGObvNjOllU0Y5u72M6WVTRjm7vYzpZV');
    
    if (id) {
      fetchWorkout(id);
      createSession(id);
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  const fetchWorkout = async (workoutId: string) => {
    try {
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .select('name')
        .eq('id', workoutId)
        .single();

      if (workoutError) throw workoutError;
      setWorkoutName(workout.name);

      const { data: items, error: itemsError } = await supabase
        .from('workout_exercises')
        .select('*, exercises(*)')
        .eq('workout_id', workoutId)
        .order('order_index');

      if (itemsError) throw itemsError;

      const mappedItems: WorkoutExerciseItem[] = (items || []).map((item: any) => ({
        id: item.id,
        exerciseId: item.exercise_id,
        sets: item.sets,
        reps: item.reps,
        restSeconds: item.rest_seconds,
        weightKg: item.weight_kg || undefined,
        notes: item.notes || undefined,
        orderIndex: item.order_index,
        exercise: {
          id: item.exercises.id,
          name: item.exercises.name,
          description: item.exercises.description,
          muscleGroup: item.exercises.muscle_group as MuscleGroup,
          category: item.exercises.category as ExerciseCategory,
          difficulty: item.exercises.difficulty as Exercise['difficulty'],
          equipment: item.exercises.equipment || undefined,
          imageUrl: item.exercises.image_url || undefined,
        },
      }));

      setExercises(mappedItems);
    } catch (error) {
      console.error('Error fetching workout:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить тренировку',
        variant: 'destructive',
      });
      navigate('/fitdb/workouts');
    } finally {
      setLoading(false);
    }
  };

  const playBeep = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  const selectExercise = (exerciseItem: WorkoutExerciseItem) => {
    setSelectedExerciseId(exerciseItem.id);
    setCurrentSet(1);
    setCurrentWeight(exerciseItem.weightKg);
    setCurrentReps(exerciseItem.reps);
    setTimerState('idle');
    setIsRunning(false);
    setTimeLeft(0);
    setViewMode('exercise');
  };

  const backToList = () => {
    setViewMode('list');
    setSelectedExerciseId(null);
    setTimerState('idle');
    setIsRunning(false);
    setTimeLeft(0);
  };

  const startRest = useCallback(() => {
    if (!selectedExercise) return;
    setTimerState('resting');
    setTimeLeft(selectedExercise.restSeconds);
    setIsRunning(true);
  }, [selectedExercise]);

  const completeSet = useCallback(async () => {
    if (!selectedExercise) return;

    await logExerciseSet(
      selectedExercise.exerciseId,
      currentSet,
      currentReps,
      currentWeight
    );

    if (currentSet < selectedExercise.sets) {
      setCurrentSet(prev => prev + 1);
      startRest();
    } else {
      // Exercise complete - mark it
      setCompletedExercises(prev => new Set([...prev, selectedExercise.id]));
      
      toast({
        title: '✓ Упражнение выполнено!',
        description: selectedExercise.exercise.name,
      });

      // Check if workout is now complete
      const newCompletedCount = completedExercises.size + 1;
      if (newCompletedCount === totalExercises) {
        await completeSession();
        playBeep();
        toast({
          title: '🎉 Тренировка завершена!',
          description: 'Результаты сохранены в истории!',
        });
      }
      
      backToList();
    }
  }, [selectedExercise, currentSet, currentWeight, currentReps, startRest, playBeep, toast, sessionId, completedExercises.size, totalExercises]);

  const adjustWeight = (delta: number) => {
    setCurrentWeight(prev => {
      const newWeight = (prev || 0) + delta;
      return newWeight >= 0 ? newWeight : 0;
    });
  };

  const adjustReps = (delta: number) => {
    setCurrentReps(prev => {
      const newReps = prev + delta;
      return newReps >= 1 ? newReps : 1;
    });
  };

  useEffect(() => {
    if (isRunning && timerState === 'resting') {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            playBeep();
            setTimerState('working');
            setIsRunning(false);
            return 0;
          }
          if (prev === 4) playBeep();
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timerState, playBeep]);

  const toggleTimer = () => {
    if (timerState === 'resting') {
      setIsRunning(!isRunning);
    }
  };

  const skipRest = () => {
    setTimerState('working');
    setIsRunning(false);
    setTimeLeft(0);
  };

  const resetExercise = () => {
    setCurrentSet(1);
    setTimerState('idle');
    setIsRunning(false);
    setTimeLeft(0);
    if (selectedExercise) {
      setCurrentReps(selectedExercise.reps);
      setCurrentWeight(selectedExercise.weightKg);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const finishWorkout = async () => {
    await completeSession();
    playBeep();
    toast({
      title: '🎉 Тренировка завершена!',
      description: 'Результаты сохранены в истории!',
    });
    navigate('/fitdb/workouts');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  // Completion screen
  if (isWorkoutComplete && viewMode === 'list') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md gradient-card border-border/50 shadow-card animate-scale-in">
          <CardContent className="p-8 text-center">
            <div className="w-24 h-24 rounded-full gradient-primary mx-auto mb-6 flex items-center justify-center shadow-glow animate-pulse-glow">
              <Check className="w-12 h-12 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Отличная работа!</h1>
            <p className="text-muted-foreground mb-6">
              Вы завершили тренировку "{workoutName}"
            </p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-muted rounded-xl p-4">
                <p className="text-2xl font-bold text-primary">{exercises.length}</p>
                <p className="text-sm text-muted-foreground">упражнений</p>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <p className="text-2xl font-bold text-primary">
                  {exercises.reduce((acc, e) => acc + e.sets, 0)}
                </p>
                <p className="text-sm text-muted-foreground">подходов</p>
              </div>
            </div>
            <Button onClick={() => navigate('/fitdb/workouts')} className="w-full shadow-glow">
              Вернуться к тренировкам
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={viewMode === 'exercise' ? backToList : () => navigate(`/workouts/${id}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {viewMode === 'list' ? 'Тренировка' : 'Упражнение'}
            </p>
            <h1 className="font-semibold text-foreground">
              {viewMode === 'list' ? workoutName : selectedExercise?.exercise.name}
            </h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="px-4 py-2 bg-muted/30">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Прогресс</span>
            <span>{completedCount} / {totalExercises} упражнений</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full">
        {viewMode === 'list' ? (
          // Exercise List View
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <List className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Выберите упражнение</h2>
            </div>
            
            {exercises.map((item) => {
              const isCompleted = completedExercises.has(item.id);
              return (
                <Card 
                  key={item.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isCompleted 
                      ? 'bg-primary/10 border-primary/30' 
                      : 'gradient-card border-border/50'
                  }`}
                  onClick={() => !isCompleted && selectExercise(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                        isCompleted ? 'bg-primary/20' : 'bg-muted'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="w-8 h-8 text-primary" />
                        ) : item.exercise.imageUrl ? (
                          <img 
                            src={item.exercise.imageUrl} 
                            alt="" 
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <span className="text-2xl">{muscleGroupIcons[item.exercise.muscleGroup]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold mb-1 ${
                          isCompleted ? 'text-primary' : 'text-foreground'
                        }`}>
                          {item.exercise.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {item.sets} × {item.reps} • {muscleGroupLabels[item.exercise.muscleGroup]}
                        </p>
                        {item.weightKg && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.weightKg} кг
                          </p>
                        )}
                      </div>
                      {isCompleted ? (
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                          Готово
                        </span>
                      ) : (
                        <Button size="sm" variant="secondary">
                          Начать
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Finish Button */}
            {completedCount > 0 && (
              <div className="pt-4">
                <Button 
                  onClick={finishWorkout}
                  variant={isWorkoutComplete ? 'default' : 'outline'}
                  className="w-full"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Завершить тренировку ({completedCount}/{totalExercises})
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Exercise Execution View
          <>
            {selectedExercise && (
              <Card className="gradient-card border-border/50 shadow-card mb-4 animate-fade-in">
                <CardContent className="p-5">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {selectedExercise.exercise.imageUrl ? (
                        <img 
                          src={selectedExercise.exercise.imageUrl} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">{muscleGroupIcons[selectedExercise.exercise.muscleGroup]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-foreground mb-1">
                        {selectedExercise.exercise.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {muscleGroupLabels[selectedExercise.exercise.muscleGroup]}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {currentSet}/{selectedExercise.sets}
                      </p>
                      <p className="text-xs text-muted-foreground">Подход</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{selectedExercise.restSeconds}с</p>
                      <p className="text-xs text-muted-foreground">Отдых</p>
                    </div>
                  </div>

                  {/* Reps Control */}
                  <div className="mt-4 p-3 bg-secondary/50 rounded-lg border border-secondary">
                    <p className="text-xs text-muted-foreground text-center mb-2">Повторения</p>
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        onClick={() => adjustReps(-1)}
                        disabled={currentReps <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="text-3xl font-bold text-foreground min-w-[60px] text-center">
                        {currentReps}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        onClick={() => adjustReps(1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Weight Control */}
                  <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground text-center mb-2">Вес (кг)</p>
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        onClick={() => adjustWeight(-2.5)}
                        disabled={!currentWeight || currentWeight <= 0}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="text-3xl font-bold text-primary min-w-[80px] text-center">
                        {currentWeight ? currentWeight : '—'}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full"
                        onClick={() => adjustWeight(2.5)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {!currentWeight && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-2 text-xs"
                        onClick={() => setCurrentWeight(10)}
                      >
                        Добавить вес
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timer Display */}
            <div className="flex-1 flex items-center justify-center">
              {timerState === 'resting' ? (
                <div className="text-center animate-scale-in">
                  <p className="text-lg text-muted-foreground mb-2">Отдых</p>
                  <div className="relative w-48 h-48 mx-auto mb-4">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="hsl(var(--muted))"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="hsl(var(--primary))"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 88}
                        strokeDashoffset={2 * Math.PI * 88 * (1 - timeLeft / (selectedExercise?.restSeconds || 60))}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-5xl font-bold text-foreground">{formatTime(timeLeft)}</span>
                    </div>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button variant="secondary" size="icon" onClick={toggleTimer}>
                      {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                    <Button variant="outline" onClick={skipRest}>
                      <SkipForward className="w-5 h-5 mr-2" />
                      Пропустить
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full bg-primary/10 mx-auto mb-6 flex items-center justify-center">
                    <Dumbbell className="w-16 h-16 text-primary" />
                  </div>
                  <p className="text-lg text-muted-foreground mb-2">
                    {timerState === 'idle' ? 'Готовы?' : 'Выполняйте упражнение'}
                  </p>
                  <p className="text-3xl font-bold text-foreground mb-6">
                    {currentReps} повторений
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-auto">
              {timerState !== 'resting' && (
                <Button 
                  onClick={completeSet} 
                  className="w-full h-14 text-lg shadow-glow"
                >
                  <Check className="w-5 h-5 mr-2" />
                  {currentSet < (selectedExercise?.sets || 0) 
                    ? 'Подход выполнен — Отдых' 
                    : 'Упражнение выполнено'
                  }
                </Button>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  onClick={resetExercise}
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Сначала
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={backToList}
                  className="flex-1"
                >
                  <List className="w-4 h-4 mr-2" />
                  К списку
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default WorkoutRun;
