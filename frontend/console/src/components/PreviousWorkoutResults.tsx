import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Weight,
  TrendingUp,
  History
} from 'lucide-react';
import { assignmentsApi, sessionsApi, workoutsApi } from '@/api/fitdb';

interface ExerciseLog {
  exerciseName: string;
  setNumber: number;
  repsCompleted: number;
  weightKg: number | null;
}

interface PreviousSession {
  id: string;
  workoutName: string;
  completedAt: string;
  durationSeconds: number | null;
  exerciseLogs: ExerciseLog[];
}

interface PreviousWorkoutResultsProps {
  clientId: string;
}

interface GroupedExercise {
  name: string;
  sets: { setNumber: number; reps: number; weight: number | null }[];
}

export const PreviousWorkoutResults = ({ clientId }: PreviousWorkoutResultsProps) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<PreviousSession | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    fetchPreviousSession();
  }, [clientId]);

  const fetchPreviousSession = async () => {
    setLoading(true);
    try {
      // Get completed assignments for this client
      const assignments = await assignmentsApi.list({
        client_id: clientId,
        status: 'completed',
      });

      if (!assignments || assignments.length === 0) {
        setSession(null);
        return;
      }

      // Get the most recent completed assignment
      const sortedAssignments = assignments.sort(
        (a: any, b: any) =>
          new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
      );

      const latestAssignment = sortedAssignments[0];
      const workoutId = String(latestAssignment.workout_id || latestAssignment.workout);

      // Get workout name
      let workoutName = 'Тренировка';
      try {
        const workout = await workoutsApi.get(workoutId);
        workoutName = workout.name;
      } catch {
        // Use default name
      }

      // Get sessions for this workout
      const sessions = await sessionsApi.list({
        workout_id: workoutId,
        ordering: '-started_at',
      });

      if (!sessions || sessions.length === 0) {
        setSession(null);
        return;
      }

      const latestSession = sessions[0];

      // For now, we don't have exercise logs API with full details
      // This would need to be expanded when exercise logs endpoint is available
      const mapped: PreviousSession = {
        id: String(latestSession.id),
        workoutName: workoutName,
        completedAt: latestSession.completed_at || latestSession.started_at,
        durationSeconds: latestSession.duration_seconds,
        exerciseLogs: [], // Would be populated from exercise logs API
      };

      setSession(mapped);
    } catch (error) {
      console.error('Error fetching previous session:', error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const groupByExercise = (logs: ExerciseLog[]): GroupedExercise[] => {
    const grouped: { [key: string]: GroupedExercise } = {};
    logs.forEach(log => {
      if (!grouped[log.exerciseName]) {
        grouped[log.exerciseName] = {
          name: log.exerciseName,
          sets: [],
        };
      }
      grouped[log.exerciseName].sets.push({
        setNumber: log.setNumber,
        reps: log.repsCompleted,
        weight: log.weightKg,
      });
    });
    // Sort sets within each exercise
    Object.values(grouped).forEach(ex => {
      ex.sets.sort((a, b) => a.setNumber - b.setNumber);
    });
    return Object.values(grouped);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 text-center">
        <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">
          Нет данных о предыдущих тренировках
        </p>
      </div>
    );
  }

  const groupedExercises = groupByExercise(session.exerciseLogs);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">
                    Предыдущая тренировка
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.workoutName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  {format(new Date(session.completedAt), 'dd.MM.yy', { locale: ru })}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
              {/* Duration */}
              {session.durationSeconds && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Длительность: {formatDuration(session.durationSeconds)}
                </div>
              )}

              {/* Exercise Results */}
              {groupedExercises.length > 0 && (
                <div className="space-y-2">
                  {groupedExercises.map((exercise, idx) => (
                    <div
                      key={idx}
                      className="bg-background/50 rounded-lg p-2"
                    >
                      <p className="text-sm font-medium text-foreground mb-1">
                        {exercise.name}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {exercise.sets.map((set, setIdx) => (
                          <div
                            key={setIdx}
                            className="flex items-center gap-1 bg-muted/50 rounded px-2 py-1 text-xs"
                          >
                            <span className="text-muted-foreground">
                              {set.setNumber}.
                            </span>
                            <span className="font-medium text-foreground">
                              {set.reps} повт
                            </span>
                            {set.weight && (
                              <span className="flex items-center text-primary">
                                <Weight className="w-3 h-3 mr-0.5" />
                                {set.weight} кг
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};
