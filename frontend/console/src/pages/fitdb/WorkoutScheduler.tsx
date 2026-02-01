import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndContext, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowLeft, ChevronLeft, ChevronRight, Dumbbell, Loader2, X, Calendar, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { workoutsApi, assignmentsApi, clientsApi } from '@/api/fitdb'

interface Workout {
  id: string
  name: string
  description: string | null
  exerciseCount: number
}

interface Assignment {
  id: string
  workoutId: string
  workoutName: string
  dueDate: string
  status: string
  notes: string
}

interface Client {
  id: string
  name: string
}

// Draggable workout card
function DraggableWorkout({ workout }: { workout: Workout }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `workout-${workout.id}`,
    data: { workout },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={16} className="text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{workout.name}</p>
          <p className="text-xs text-muted-foreground">{workout.exerciseCount} упр.</p>
        </div>
      </div>
    </div>
  )
}

// Droppable day row (horizontal layout for weekly view)
function DayDropZone({
  date,
  assignments,
  onRemoveAssignment,
}: {
  date: Date
  assignments: Assignment[]
  onRemoveAssignment: (id: string) => void
}) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr}`,
    data: { date: dateStr },
  })

  const isToday = isSameDay(date, new Date())
  const isPast = date < new Date() && !isToday
  const dayAssignments = assignments.filter((a) => a.dueDate === dateStr)

  return (
    <div
      ref={setNodeRef}
      className={`
        flex items-stretch border-b border-border/50 transition-colors min-h-[72px]
        ${isOver ? 'bg-primary/10' : ''}
        ${isToday ? 'bg-primary/5' : ''}
        ${isPast ? 'opacity-60' : ''}
      `}
    >
      {/* Date column */}
      <div className={`
        w-32 shrink-0 p-3 border-r border-border/50 flex flex-col justify-center
        ${isToday ? 'bg-primary/10' : 'bg-muted/30'}
      `}>
        <div className="flex items-center gap-2">
          <span className={`
            text-2xl font-bold
            ${isToday ? 'text-primary' : 'text-foreground'}
          `}>
            {format(date, 'd')}
          </span>
          {isToday && (
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
              Сегодня
            </span>
          )}
        </div>
        <p className={`text-sm capitalize ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
          {format(date, 'EEEE', { locale: ru })}
        </p>
      </div>

      {/* Workouts column */}
      <div className="flex-1 p-3 flex items-center gap-2 flex-wrap">
        {dayAssignments.map((assignment) => (
          <div
            key={assignment.id}
            className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2 group hover:border-primary/50 transition-colors"
          >
            <Dumbbell size={16} className="text-primary shrink-0" />
            <span className="text-sm font-medium">{assignment.workoutName}</span>
            <button
              type="button"
              onClick={() => onRemoveAssignment(assignment.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity ml-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {dayAssignments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isOver ? 'Отпустите для назначения' : 'Перетащите тренировку сюда'}
          </p>
        )}
      </div>
    </div>
  )
}

// Workout drag overlay
function WorkoutDragOverlay({ workout }: { workout: Workout }) {
  return (
    <div className="bg-card border-2 border-primary rounded-lg p-3 shadow-lg w-64">
      <div className="flex items-start gap-2">
        <Dumbbell size={16} className="text-primary mt-0.5" />
        <div>
          <p className="font-medium text-sm">{workout.name}</p>
          <p className="text-xs text-muted-foreground">{workout.exerciseCount} упр.</p>
        </div>
      </div>
    </div>
  )
}

export default function WorkoutScheduler() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [activeDragWorkout, setActiveDragWorkout] = useState<Workout | null>(null)

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Load client info
        if (clientId) {
          const clientData = await clientsApi.get(clientId)
          setClient({ id: String(clientData.id), name: clientData.name })
        }

        // Load workouts
        const workoutsData = await workoutsApi.list({ ordering: 'name' })
        setWorkouts(
          (workoutsData || []).map((w: any) => ({
            id: String(w.id),
            name: w.name,
            description: w.description,
            exerciseCount: w.exercise_count || 0,
          }))
        )

        // Load assignments for this client
        if (clientId) {
          const assignmentsData = await assignmentsApi.list({ client_id: clientId })
          setAssignments(
            (assignmentsData || []).map((a: any) => ({
              id: String(a.id),
              workoutId: String(a.workout_id),
              workoutName: a.workout_detail?.name || a.workout?.name || 'Тренировка',
              dueDate: a.due_date,
              status: a.status,
              notes: a.notes || '',
            }))
          )
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить данные',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [clientId, toast])

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const workout = event.active.data.current?.workout as Workout | undefined
    if (workout) {
      setActiveDragWorkout(workout)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragWorkout(null)

    const { active, over } = event
    if (!over || !clientId) return

    const workout = active.data.current?.workout as Workout | undefined
    const dropData = over.data.current as { date: string } | undefined

    if (!workout || !dropData?.date) return

    try {
      // Create assignment
      const result = await assignmentsApi.create({
        workout_id: workout.id,
        client_id: clientId,
        due_date: dropData.date,
      })

      // Add to local state
      setAssignments((prev) => [
        ...prev,
        {
          id: String(result.id),
          workoutId: workout.id,
          workoutName: workout.name,
          dueDate: dropData.date,
          status: 'pending',
          notes: '',
        },
      ])

      toast({
        title: 'Тренировка назначена',
        description: `${workout.name} на ${format(new Date(dropData.date), 'd MMMM', { locale: ru })}`,
      })
    } catch (error) {
      console.error('Error creating assignment:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось назначить тренировку',
        variant: 'destructive',
      })
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await assignmentsApi.delete(assignmentId)
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
      toast({ title: 'Тренировка удалена из расписания' })
    } catch (error) {
      console.error('Error deleting assignment:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить назначение',
        variant: 'destructive',
      })
    }
  }

  const goToPreviousWeek = () => setWeekStart((prev) => addDays(prev, -7))
  const goToNextWeek = () => setWeekStart((prev) => addDays(prev, 7))
  const goToCurrentWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Расписание тренировок</h1>
                  {client && <p className="text-sm text-muted-foreground">{client.name}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Сегодня
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <div className="flex gap-6">
            {/* Left: Weekly Calendar (vertical) */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {format(weekStart, 'd MMMM', { locale: ru })} — {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: ru })}
                </h2>
              </div>

              <div className="bg-card border border-border rounded-lg overflow-hidden">
                {weekDays.map((date) => (
                  <DayDropZone
                    key={date.toISOString()}
                    date={date}
                    assignments={assignments}
                    onRemoveAssignment={handleRemoveAssignment}
                  />
                ))}
              </div>
            </div>

            {/* Right: Workouts panel */}
            <div className="w-80 shrink-0">
              <div className="sticky top-20">
                <div className="bg-card border border-border rounded-lg p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Dumbbell size={16} className="text-primary" />
                    Тренировки ({workouts.length})
                  </h2>

                  <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
                    {workouts.length > 0 ? (
                      workouts.map((workout) => (
                        <DraggableWorkout key={workout.id} workout={workout} />
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Нет тренировок</p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => navigate('/fitdb/workouts/new')}
                          className="mt-2"
                        >
                          Создать тренировку
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragWorkout && <WorkoutDragOverlay workout={activeDragWorkout} />}
      </DragOverlay>
    </DndContext>
  )
}
