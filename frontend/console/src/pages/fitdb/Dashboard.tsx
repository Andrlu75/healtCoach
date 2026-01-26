import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Dumbbell, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Award,
  ArrowLeft,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from "recharts";

interface ClientWithStats {
  id: string;
  name: string;
  email: string | null;
  total: number;
  completed: number;
  completionRate: number;
}

interface Assignment {
  id: string;
  status: string;
  client_id: string;
  assigned_at: string;
  clients: {
    id: string;
    name: string;
    email: string | null;
  };
}

const Dashboard = () => {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, assignmentsRes] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('workout_assignments').select(`
          id,
          status,
          client_id,
          assigned_at,
          clients(id, name, email)
        `).order('assigned_at', { ascending: false })
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      const assignmentData = (assignmentsRes.data || []) as unknown as Assignment[];
      setAssignments(assignmentData);

      // Calculate stats per client
      const clientStats = (clientsRes.data || []).map(client => {
        const clientAssignments = assignmentData.filter(a => a.client_id === client.id);
        const total = clientAssignments.length;
        const completed = clientAssignments.filter(a => a.status === 'completed').length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          id: client.id,
          name: client.name,
          email: client.email,
          total,
          completed,
          completionRate
        };
      });

      setClients(clientStats);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const globalStats = useMemo(() => {
    const totalClients = clients.length;
    const totalAssignments = assignments.length;
    const completedAssignments = assignments.filter(a => a.status === 'completed').length;
    const activeAssignments = assignments.filter(a => a.status === 'active').length;
    const pendingAssignments = assignments.filter(a => a.status === 'pending').length;
    const overallCompletionRate = totalAssignments > 0 
      ? Math.round((completedAssignments / totalAssignments) * 100) 
      : 0;

    // This month stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthAssignments = assignments.filter(
      a => new Date(a.assigned_at) >= startOfMonth
    ).length;
    const thisMonthCompleted = assignments.filter(
      a => a.status === 'completed' && new Date(a.assigned_at) >= startOfMonth
    ).length;

    // Top performers
    const topPerformers = [...clients]
      .filter(c => c.total >= 3)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);

    return {
      totalClients,
      totalAssignments,
      completedAssignments,
      activeAssignments,
      pendingAssignments,
      overallCompletionRate,
      thisMonthAssignments,
      thisMonthCompleted,
      topPerformers
    };
  }, [clients, assignments]);

  const pieChartData = useMemo(() => [
    { name: 'Выполнено', value: globalStats.completedAssignments, color: 'hsl(var(--primary))' },
    { name: 'В процессе', value: globalStats.activeAssignments, color: 'hsl(var(--chart-2))' },
    { name: 'Ожидает', value: globalStats.pendingAssignments, color: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0), [globalStats]);

  const barChartData = useMemo(() => 
    clients
      .filter(c => c.total > 0)
      .slice(0, 8)
      .map(c => ({
        name: c.name.split(' ')[0],
        Выполнено: c.completed,
        Всего: c.total - c.completed
      })),
    [clients]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Дашборд</h1>
              <p className="text-muted-foreground">Общая статистика по клиентам</p>
            </div>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Всего клиентов
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{globalStats.totalClients}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Назначено тренировок
              </CardTitle>
              <Dumbbell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{globalStats.totalAssignments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                +{globalStats.thisMonthAssignments} в этом месяце
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Выполнено
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {globalStats.completedAssignments}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +{globalStats.thisMonthCompleted} в этом месяце
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Общий прогресс
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{globalStats.overallCompletionRate}%</div>
              <Progress value={globalStats.overallCompletionRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Распределение по статусам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Нет данных для отображения
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5" />
                Прогресс по клиентам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData}>
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Выполнено" stackId="a" fill="hsl(var(--primary))" />
                      <Bar dataKey="Всего" stackId="a" fill="hsl(var(--muted))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Нет данных для отображения
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{globalStats.completedAssignments}</p>
                  <p className="text-sm text-muted-foreground">Выполнено</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-chart-2">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-chart-2" />
                <div>
                  <p className="text-2xl font-bold">{globalStats.activeAssignments}</p>
                  <p className="text-sm text-muted-foreground">В процессе</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-muted-foreground">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Dumbbell className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{globalStats.pendingAssignments}</p>
                  <p className="text-sm text-muted-foreground">Ожидает</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performers */}
        {globalStats.topPerformers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                Лучшие результаты
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Клиент</TableHead>
                    <TableHead className="text-center">Всего</TableHead>
                    <TableHead className="text-center">Выполнено</TableHead>
                    <TableHead className="text-center">Прогресс</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {globalStats.topPerformers.map((client, index) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link 
                          to={`/clients/${client.id}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          {index === 0 && <span className="text-yellow-500">🥇</span>}
                          {index === 1 && <span className="text-gray-400">🥈</span>}
                          {index === 2 && <span className="text-amber-600">🥉</span>}
                          <span className="font-medium">{client.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">{client.total}</TableCell>
                      <TableCell className="text-center">{client.completed}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={client.completionRate >= 80 ? "default" : "secondary"}>
                          {client.completionRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* All Clients Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Все клиенты
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Тренировок</TableHead>
                    <TableHead className="text-center">Выполнено</TableHead>
                    <TableHead className="text-center">Прогресс</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link 
                          to={`/clients/${client.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {client.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.email || '—'}
                      </TableCell>
                      <TableCell className="text-center">{client.total}</TableCell>
                      <TableCell className="text-center">{client.completed}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={client.completionRate} className="w-16" />
                          <span className="text-sm text-muted-foreground w-10">
                            {client.completionRate}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Нет клиентов для отображения
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
