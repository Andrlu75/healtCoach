import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Plus, 
  Loader2,
  User,
  Phone,
  Mail,
  Dumbbell,
  Calendar,
  Trash2,
  CheckCircle2,
  Clock,
  PlayCircle,
  TrendingUp,
  Target,
  Award
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { clientsApi, assignmentsApi } from '@/api/fitdb';
import { AssignWorkoutWizard } from '@/components/AssignWorkoutWizard';

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

interface Assignment {
  id: string;
  workout_id: string;
  workout_name: string;
  assigned_at: string;
  due_date: string | null;
  status: 'pending' | 'active' | 'completed';
  notes: string | null;
}

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  active: 'В процессе',
  completed: 'Выполнено',
};

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  active: 'bg-primary/20 text-primary',
  completed: 'bg-accent text-accent-foreground',
};

const ClientDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter(a => a.status === 'completed').length;
    const active = assignments.filter(a => a.status === 'active').length;
    const pending = assignments.filter(a => a.status === 'pending').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Calculate streak - consecutive completed workouts
    const sortedCompleted = assignments
      .filter(a => a.status === 'completed')
      .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
    
    let streak = 0;
    for (const _assignment of sortedCompleted) {
      streak++;
      // Simple streak - just count completed
    }
    
    // This month stats
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const completedThisMonth = assignments.filter(a => 
      a.status === 'completed' && 
      new Date(a.assigned_at) >= thisMonth
    ).length;
    
    return { total, completed, active, pending, completionRate, streak, completedThisMonth };
  }, [assignments]);

  useEffect(() => {
    if (id) {
      fetchClient(id);
      fetchAssignments(id);
    }
  }, [id]);

  const fetchClient = async (clientId: string) => {
    try {
      const data = await clientsApi.get(clientId);
      if (!data) {
        toast({
          title: 'Клиент не найден',
          variant: 'destructive',
        });
        navigate('/fitdb/clients');
        return;
      }
      setClient({
        id: String(data.id),
        name: data.name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        created_at: data.created_at,
      });
    } catch (error) {
      console.error('Error fetching client:', error);
      navigate('/fitdb/clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async (clientId: string) => {
    try {
      const data = await assignmentsApi.list({ client_id: clientId });

      // Workout details are now included in the response - no extra API calls needed
      const mapped: Assignment[] = (data || []).map((a: any) => {
        const workoutDetail = a.workout_detail || {};
        return {
          id: String(a.id),
          workout_id: String(a.workout_id || a.workout),
          workout_name: workoutDetail.name || 'Тренировка',
          assigned_at: a.assigned_at || a.created_at,
          due_date: a.due_date,
          status: a.status,
          notes: a.notes,
        };
      });

      // Sort by assigned_at descending
      mapped.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());

      setAssignments(mapped);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const updateStatus = async (assignmentId: string, newStatus: string) => {
    try {
      await assignmentsApi.update(assignmentId, { status: newStatus });
      if (id) fetchAssignments(id);

      if (newStatus === 'completed') {
        toast({ title: '🎉 Тренировка выполнена!' });
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    try {
      await assignmentsApi.delete(assignmentId);
      toast({ title: 'Назначение удалено' });
      if (id) fetchAssignments(id);
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate('/fitdb/clients')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">{client.name}</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* Client Info Card */}
        <Card className="gradient-card border-border/50 mb-4">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{client.name}</h2>
                <div className="flex flex-col gap-1 mt-1 text-sm text-muted-foreground">
                  {client.phone && (
                    <span className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {client.phone}
                    </span>
                  )}
                  {client.email && (
                    <span className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {client.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {client.notes && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                {client.notes}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Statistics Section */}
        <Card className="gradient-card border-border/50 mb-4">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              Статистика
            </h3>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Прогресс выполнения</span>
                <span className="font-semibold text-primary">{stats.completionRate}%</span>
              </div>
              <Progress value={stats.completionRate} className="h-3" />
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{stats.total}</span>
                </div>
                <p className="text-xs text-muted-foreground">Всего назначено</p>
              </div>
              
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{stats.completed}</span>
                </div>
                <p className="text-xs text-muted-foreground">Выполнено</p>
              </div>
              
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <PlayCircle className="w-4 h-4 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{stats.active}</span>
                </div>
                <p className="text-xs text-muted-foreground">В процессе</p>
              </div>
              
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-primary" />
                  <span className="text-2xl font-bold text-foreground">{stats.completedThisMonth}</span>
                </div>
                <p className="text-xs text-muted-foreground">В этом месяце</p>
              </div>
            </div>
            
            {/* Achievement badges */}
            {stats.completed >= 5 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {stats.completed >= 5 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    🏆 5+ тренировок
                  </Badge>
                )}
                {stats.completed >= 10 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    🔥 10+ тренировок
                  </Badge>
                )}
                {stats.completionRate >= 80 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    ⭐ Отличный результат
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assignments Section */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            Назначенные тренировки
          </h3>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Назначить
          </Button>
        </div>

        {/* Assignment Wizard */}
        <AssignWorkoutWizard
          clientId={id || ''}
          clientName={client.name}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => id && fetchAssignments(id)}
        />

        {assignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Dumbbell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Нет назначенных тренировок</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <Card key={assignment.id} className="gradient-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">
                          {assignment.workout_name}
                        </h4>
                        <Badge className={statusColors[assignment.status]}>
                          {statusLabels[assignment.status]}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Назначено: {format(new Date(assignment.assigned_at), 'dd.MM.yyyy', { locale: ru })}
                        </p>
                        {assignment.due_date && (
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Выполнить до: {format(new Date(assignment.due_date), 'dd.MM.yyyy', { locale: ru })}
                          </p>
                        )}
                        {assignment.notes && (
                          <p className="text-xs italic">{assignment.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {assignment.status !== 'completed' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => updateStatus(assignment.id, 'completed')}
                          title="Отметить выполненным"
                        >
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                      {assignment.status === 'pending' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => updateStatus(assignment.id, 'active')}
                          title="Начать"
                        >
                          <PlayCircle className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => deleteAssignment(assignment.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ClientDetail;
