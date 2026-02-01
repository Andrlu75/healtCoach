import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndContext, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowLeft, ChevronLeft, ChevronRight, Dumbbell, Loader2, X, Calendar, GripVertical, Plus, Minus, Trash2, Search, Save, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { workoutsApi, assignmentsApi, clientsApi, workoutExercisesApi, exercisesApi } from '@/api/fitdb'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

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

interface Exercise {
  id: string
  name: string
  muscleGroup: string
  category?: string
}

interface WorkoutExerciseItem {
  id: string
  exerciseId: string
  exercise: Exercise
  sets: number
  reps: number
  restSeconds: number
  weightKg?: number
  durationSeconds?: number
  distanceMeters?: number
  orderIndex: number
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
  onEditAssignment,
}: {
  date: Date
  assignments: Assignment[]
  onRemoveAssignment: (id: string) => void
  onEditAssignment: (assignment: Assignment) => void
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
            onClick={() => onEditAssignment(assignment)}
            className="bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2 group hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Dumbbell size={16} className="text-primary shrink-0" />
            <span className="text-sm font-medium">{assignment.workoutName}</span>
            <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveAssignment(assignment.id)
              }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
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

  // Состояние для редактирования назначенной тренировки
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [editingExercises, setEditingExercises] = useState<WorkoutExerciseItem[]>([])
  const [editingLoading, setEditingLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exerciseSelectorOpen, setExerciseSelectorOpen] = useState(false)
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([])
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('')
  const [exerciseSearchLoading, setExerciseSearchLoading] = useState(false)

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

  // Открыть редактор назначенной тренировки
  const handleEditAssignment = async (assignment: Assignment) => {
    setEditingAssignment(assignment)
    setEditingLoading(true)

    try {
      const exercises = await workoutExercisesApi.list(assignment.workoutId)
      const mapped: WorkoutExerciseItem[] = (exercises || []).map((item: any) => ({
        id: String(item.id),
        exerciseId: String(item.exercise_id),
        exercise: {
          id: String(item.exercise?.id || item.exercise_id),
          name: item.exercise?.name || 'Упражнение',
          muscleGroup: item.exercise?.muscle_group || '',
          category: item.exercise?.category || 'strength',
        },
        sets: item.sets,
        reps: item.reps,
        restSeconds: item.rest_seconds,
        weightKg: item.weight_kg || undefined,
        durationSeconds: item.duration_seconds || undefined,
        distanceMeters: item.distance_meters || undefined,
        orderIndex: item.order_index || 0,
      }))
      mapped.sort((a, b) => a.orderIndex - b.orderIndex)
      setEditingExercises(mapped)
    } catch (error) {
      console.error('Error loading workout exercises:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить упражнения',
        variant: 'destructive',
      })
    } finally {
      setEditingLoading(false)
    }
  }

  // Сохранить изменения в тренировке (клонировать с изменениями)
  const handleSaveEditedWorkout = async () => {
    if (!editingAssignment || !clientId) return

    setSaving(true)
    try {
      // Клонируем тренировку с изменёнными упражнениями
      const newWorkout = await workoutsApi.clone(editingAssignment.workoutId, {
        name: `${editingAssignment.workoutName} (для ${client?.name})`,
        client_id: clientId,
        exercises: editingExercises.map((ex) => ({
          exercise_id: ex.exerciseId,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.restSeconds,
          weight_kg: ex.weightKg,
          duration_seconds: ex.durationSeconds,
          distance_meters: ex.distanceMeters,
        })),
      })

      // Обновляем назначение с новой тренировкой
      await assignmentsApi.update(editingAssignment.id, {
        notes: `Персонализированная версия: ${newWorkout.name}`,
      })

      // Обновляем локальное состояние
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === editingAssignment.id
            ? { ...a, workoutId: String(newWorkout.id), workoutName: newWorkout.name }
            : a
        )
      )

      toast({
        title: 'Тренировка сохранена',
        description: 'Создана персонализированная версия',
      })
      setEditingAssignment(null)
    } catch (error) {
      console.error('Error saving workout:', error)
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить изменения',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Функции редактирования упражнений
  const updateExercise = (id: string, updates: Partial<WorkoutExerciseItem>) => {
    setEditingExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, ...updates } : ex))
    )
  }

  const removeExercise = (id: string) => {
    setEditingExercises((prev) => prev.filter((ex) => ex.id !== id))
  }

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const newExercises = [...editingExercises]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newExercises.length) return
    ;[newExercises[index], newExercises[newIndex]] = [newExercises[newIndex], newExercises[index]]
    setEditingExercises(newExercises.map((ex, i) => ({ ...ex, orderIndex: i })))
  }

  // Поиск упражнений для добавления
  const searchExercises = async (query: string) => {
    setExerciseSearchLoading(true)
    try {
      const data = await exercisesApi.list({ search: query || undefined, ordering: 'name' })
      setAvailableExercises(
        (data || []).map((e: any) => ({
          id: String(e.id),
          name: e.name,
          muscleGroup: e.muscleGroup || e.muscle_group || '',
          category: e.category || 'strength',
        }))
      )
    } catch (error) {
      console.error('Error searching exercises:', error)
    } finally {
      setExerciseSearchLoading(false)
    }
  }

  const addExerciseToWorkout = (exercise: Exercise) => {
    const timeBasedCategories = ['cardio', 'warmup', 'cooldown', 'flexibility']
    const isTimeBased = timeBasedCategories.includes(exercise.category || '')
    const isCardio = exercise.category === 'cardio'

    const newExercise: WorkoutExerciseItem = {
      id: `new-${Date.now()}`,
      exerciseId: exercise.id,
      exercise,
      sets: isTimeBased ? 1 : 3,
      reps: isTimeBased ? 1 : 10,
      restSeconds: isTimeBased ? 0 : 60,
      durationSeconds: isTimeBased ? (isCardio ? 600 : 300) : undefined,
      distanceMeters: isCardio ? 1000 : undefined,
      orderIndex: editingExercises.length,
    }
    setEditingExercises((prev) => [...prev, newExercise])
    setExerciseSelectorOpen(false)
    setExerciseSearchQuery('')
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
                    onEditAssignment={handleEditAssignment}
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

      {/* Диалог редактирования назначенной тренировки */}
      <Dialog open={!!editingAssignment} onOpenChange={(open) => !open && setEditingAssignment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" />
              {editingAssignment?.workoutName}
            </DialogTitle>
          </DialogHeader>

          {editingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {editingExercises.map((ex, index) => {
                const timeBasedCategories = ['cardio', 'warmup', 'cooldown', 'flexibility']
                const isTimeBased = timeBasedCategories.includes(ex.exercise.category || '')
                const isCardio = ex.exercise.category === 'cardio'

                return (
                  <Card key={ex.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveExercise(index, 'up')}
                              disabled={index === 0}
                            >
                              <ChevronLeft className="w-4 h-4 rotate-90" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveExercise(index, 'down')}
                              disabled={index === editingExercises.length - 1}
                            >
                              <ChevronRight className="w-4 h-4 rotate-90" />
                            </Button>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{ex.exercise.name}</p>
                            <p className="text-sm text-muted-foreground">{ex.exercise.muscleGroup}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeExercise(ex.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {isTimeBased ? (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Время (мин)</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  durationSeconds: Math.max(60, (ex.durationSeconds || 0) - 60)
                                })}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">
                                {Math.round((ex.durationSeconds || 0) / 60)}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  durationSeconds: (ex.durationSeconds || 0) + 60
                                })}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          {isCardio && (
                            <div>
                              <label className="text-xs text-muted-foreground">Дистанция (км)</label>
                              <div className="flex items-center gap-2 mt-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateExercise(ex.id, {
                                    distanceMeters: Math.max(0, (ex.distanceMeters || 0) - 500)
                                  })}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-10 text-center font-medium">
                                  {((ex.distanceMeters || 0) / 1000).toFixed(1)}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => updateExercise(ex.id, {
                                    distanceMeters: (ex.distanceMeters || 0) + 500
                                  })}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="text-xs text-muted-foreground">Отдых (сек)</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  restSeconds: Math.max(0, ex.restSeconds - 15)
                                })}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">{ex.restSeconds}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  restSeconds: ex.restSeconds + 15
                                })}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Подходы</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  sets: Math.max(1, ex.sets - 1)
                                })}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-6 text-center font-medium">{ex.sets}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, { sets: ex.sets + 1 })}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Повторы</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  reps: Math.max(1, ex.reps - 1)
                                })}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-6 text-center font-medium">{ex.reps}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, { reps: ex.reps + 1 })}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Вес (кг)</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  weightKg: Math.max(0, (ex.weightKg || 0) - 2.5)
                                })}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">{ex.weightKg || '—'}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  weightKg: (ex.weightKg || 0) + 2.5
                                })}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Отдых</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  restSeconds: Math.max(0, ex.restSeconds - 15)
                                })}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">{ex.restSeconds}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateExercise(ex.id, {
                                  restSeconds: ex.restSeconds + 15
                                })}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}

              {/* Кнопка добавления упражнения */}
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => {
                  setExerciseSelectorOpen(true)
                  searchExercises('')
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить упражнение
              </Button>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditingAssignment(null)}
            >
              Отмена
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveEditedWorkout}
              disabled={saving || editingExercises.length === 0}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог выбора упражнения */}
      <Dialog open={exerciseSelectorOpen} onOpenChange={setExerciseSelectorOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Добавить упражнение</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск упражнений..."
              value={exerciseSearchQuery}
              onChange={(e) => {
                setExerciseSearchQuery(e.target.value)
                searchExercises(e.target.value)
              }}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-4">
            {exerciseSearchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : availableExercises.length > 0 ? (
              availableExercises
                .filter((e) => !editingExercises.some((ex) => ex.exerciseId === e.id))
                .map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => addExerciseToWorkout(exercise)}
                    className="w-full p-3 rounded-lg bg-muted/50 hover:bg-muted border border-border/50 hover:border-primary/30 transition-all text-left flex items-center gap-3"
                  >
                    <Dumbbell className="w-5 h-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{exercise.name}</p>
                      <p className="text-sm text-muted-foreground">{exercise.muscleGroup}</p>
                    </div>
                    <Plus className="w-5 h-5 text-primary" />
                  </button>
                ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {exerciseSearchQuery ? 'Упражнения не найдены' : 'Введите запрос для поиска'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}
