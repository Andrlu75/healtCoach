import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  Trash2,
  Weight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sessionsApi } from '@/api/fitdb';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  repsCompleted: number;
  weightKg: number | null;
  completedAt: string;
}

interface WorkoutSession {
  id: string;
  workoutId: string;
  workoutName: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  exerciseLogs: ExerciseLog[];
}

const WorkoutHistory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const sessionsData = await sessionsApi.list({ ordering: '-started_at' });

      const mapped: WorkoutSession[] = (sessionsData || []).map((s: any) => ({
        id: String(s.id),
        workoutId: String(s.workout_id || s.workout),
        workoutName: s.workout?.name || s.workout_detail?.name || 'Тренировка',
        startedAt: s.started_at,
        completedAt: s.completed_at || s.finished_at,
        durationSeconds: s.duration_seconds,
        exerciseLogs: [], // Exercise logs would need separate API
      }));

      setSessions(mapped);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить историю',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await sessionsApi.delete(sessionId);

      setSessions(sessions.filter(s => s.id !== sessionId));
      toast({
        title: 'Запись удалена',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить запись',
        variant: 'destructive',
      });
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group logs by exercise
  const groupLogsByExercise = (logs: ExerciseLog[]) => {
    const grouped: { [key: string]: ExerciseLog[] } = {};
    logs.forEach(log => {
      if (!grouped[log.exerciseName]) {
        grouped[log.exerciseName] = [];
      }
      grouped[log.exerciseName].push(log);
    });
    return grouped;
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
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/fitdb/workouts')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">История тренировок</h1>
              <p className="text-sm text-muted-foreground">{sessions.length} записей</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        {sessions.length > 0 ? (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Collapsible
                key={session.id}
                open={expandedSessions.has(session.id)}
                onOpenChange={() => toggleSession(session.id)}
              >
                <Card className="gradient-card border-border/50 shadow-card animate-fade-in">
                  <CardContent className="p-4">
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-foreground mb-1">
                            {session.workoutName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(session.startedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatTime(session.startedAt)}
                            </span>
                            {session.durationSeconds && (
                              <span className="flex items-center gap-1">
                                <Dumbbell className="w-4 h-4" />
                                {formatDuration(session.durationSeconds)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                          {expandedSessions.has(session.id) ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
                        {Object.entries(groupLogsByExercise(session.exerciseLogs)).map(
                          ([exerciseName, logs]) => (
                            <div key={exerciseName}>
                              <h4 className="font-medium text-foreground mb-2">
                                {exerciseName}
                              </h4>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div className="text-muted-foreground font-medium">Подход</div>
                                <div className="text-muted-foreground font-medium">Повторы</div>
                                <div className="text-muted-foreground font-medium">Вес</div>
                                {logs.sort((a, b) => a.setNumber - b.setNumber).map((log) => (
                                  <>
                                    <div key={`${log.id}-set`} className="text-foreground">
                                      {log.setNumber}
                                    </div>
                                    <div key={`${log.id}-reps`} className="text-foreground">
                                      {log.repsCompleted}
                                    </div>
                                    <div key={`${log.id}-weight`} className="text-foreground flex items-center gap-1">
                                      {log.weightKg ? (
                                        <>
                                          <Weight className="w-3 h-3 text-primary" />
                                          {log.weightKg} кг
                                        </>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </div>
                                  </>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
              <Calendar className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              История пуста
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Завершите свою первую тренировку, чтобы увидеть историю здесь
            </p>
            <Button onClick={() => navigate('/fitdb/workouts')} className="shadow-glow">
              Перейти к тренировкам
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default WorkoutHistory;
