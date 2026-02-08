import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndContext, DragOverlay, useDroppable, useDraggable, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowLeft, ChevronLeft, ChevronRight, Dumbbell, Loader2, X, Calendar, GripVertical, Plus, Minus, Trash2, Search, Save, Edit3, Tag, Check, Clock, Zap, Heart, Target, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { workoutsApi, assignmentsApi, clientsApi, workoutExercisesApi, exercisesApi } from '@/api/fitdb'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Workout {
  id: string
  name: string
  description: string | null
  exerciseCount: number
  tags: string[]
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

// Draggable workout card - красивая плашка
function DraggableWorkout({
  workout,
  onEditTags,
  onEditTemplate
}: {
  workout: Workout
  onEditTags: (workout: Workout) => void
  onEditTemplate: (workoutId: string) => void
}) {
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
      className="bg-gradient-to-br from-card to-muted/20 border border-border rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all group"
    >
      {/* Drag area */}
      <div
        className="p-4 cursor-grab active:cursor-grabbing"
        {...listeners}
        {...attributes}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Dumbbell size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground leading-snug mb-2">{workout.name}</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target size={14} />
                {workout.exerciseCount} упр.
              </span>
            </div>
          </div>
          <GripVertical size={20} className="text-muted-foreground/40 shrink-0 mt-1" />
        </div>
      </div>

      {/* Footer with tags and actions */}
      <div className="px-4 pb-3 pt-1">
        {/* Теги */}
        {workout.tags && workout.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {workout.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditTemplate(workout.id)
            }}
            className="flex-1 h-8 rounded-lg bg-muted hover:bg-primary/10 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Pencil size={12} />
            Редактировать
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditTags(workout)
            }}
            className="h-8 px-3 rounded-lg bg-muted hover:bg-primary/10 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Tag size={12} />
            Теги
          </button>
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

function SortableExerciseItem({ id, children }: {
  id: string
  children: (props: { dragHandleProps: Record<string, any>; isDragging: boolean }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners }, isDragging })}
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

  // Состояние для тегов и фильтрации
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [editingTagsWorkout, setEditingTagsWorkout] = useState<Workout | null>(null)
  const [newTagInput, setNewTagInput] = useState('')

  // Sensors для drag-and-drop упражнений в модали
  const exerciseSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

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

        // Load all tags
        const tagsData = await workoutsApi.getTags()
        setAllTags(tagsData || [])

        // Load workout templates only
        const workoutsData = await workoutsApi.list({ ordering: 'name', is_template: true })
        setWorkouts(
          (workoutsData || []).map((w: any) => ({
            id: String(w.id),
            name: w.name,
            description: w.description,
            exerciseCount: w.exercise_count || 0,
            tags: w.tags || [],
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
    console.log('DragEnd event:', { active, over, clientId })

    if (!over || !clientId) {
      console.log('DragEnd aborted: no over or clientId', { over, clientId })
      return
    }

    const workout = active.data.current?.workout as Workout | undefined
    const dropData = over.data.current as { date: string } | undefined

    console.log('DragEnd data:', { workout, dropData })

    if (!workout || !dropData?.date) {
      console.log('DragEnd aborted: no workout or date', { workout, dropData })
      return
    }

    try {
      console.log('Creating assignment:', { workout_id: workout.id, client_id: clientId, due_date: dropData.date })
      // Create assignment
      const result = await assignmentsApi.create({
        workout_id: workout.id,
        client_id: clientId,
        due_date: dropData.date,
      })
      console.log('Assignment created:', result)

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
      const mapped: WorkoutExerciseItem[] = (exercises || []).map((item: any) => {
        const muscleGroup = item.exercise?.muscle_group || ''
        // Определяем категорию: сначала из API, потом по muscle_group
        let category = item.exercise?.category || ''
        if (!category && muscleGroup === 'cardio') {
          category = 'cardio'
        }
        if (!category) {
          category = 'strength'
        }

        return {
          id: String(item.id),
          exerciseId: String(item.exercise_id),
          exercise: {
            id: String(item.exercise?.id || item.exercise_id),
            name: item.exercise?.name || 'Упражнение',
            muscleGroup,
            category,
          },
          sets: item.sets,
          reps: item.reps,
          restSeconds: item.rest_seconds,
          weightKg: item.weight_kg || undefined,
          durationSeconds: item.duration_seconds || undefined,
          distanceMeters: item.distance_meters || undefined,
          orderIndex: item.order_index || 0,
        }
      })
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

  const handleExerciseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setEditingExercises(prev => {
      const oldIndex = prev.findIndex(e => e.id === String(active.id))
      const newIndex = prev.findIndex(e => e.id === String(over.id))
      return arrayMove(prev, oldIndex, newIndex).map((ex, i) => ({ ...ex, orderIndex: i }))
    })
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

  // Фильтрованные тренировки по выбранному тегу
  const filteredWorkouts = selectedTag
    ? workouts.filter((w) => w.tags && w.tags.includes(selectedTag))
    : workouts

  // Обновление тегов тренировки
  const handleUpdateWorkoutTags = async (workoutId: string, tags: string[]) => {
    try {
      await workoutsApi.update(workoutId, { tags })
      setWorkouts((prev) =>
        prev.map((w) => (w.id === workoutId ? { ...w, tags } : w))
      )
      // Обновить список всех тегов
      const newAllTags = new Set(allTags)
      tags.forEach((t) => newAllTags.add(t))
      setAllTags(Array.from(newAllTags).sort())
      toast({ title: 'Теги обновлены' })
    } catch (error) {
      console.error('Error updating tags:', error)
      toast({ title: 'Ошибка', description: 'Не удалось обновить теги', variant: 'destructive' })
    }
  }

  const addTagToWorkout = (tag: string) => {
    if (!editingTagsWorkout) return
    const currentTags = editingTagsWorkout.tags || []
    if (!currentTags.includes(tag)) {
      const newTags = [...currentTags, tag]
      handleUpdateWorkoutTags(editingTagsWorkout.id, newTags)
      setEditingTagsWorkout({ ...editingTagsWorkout, tags: newTags })
    }
    setNewTagInput('')
  }

  const removeTagFromWorkout = (tag: string) => {
    if (!editingTagsWorkout) return
    const newTags = (editingTagsWorkout.tags || []).filter((t) => t !== tag)
    handleUpdateWorkoutTags(editingTagsWorkout.id, newTags)
    setEditingTagsWorkout({ ...editingTagsWorkout, tags: newTags })
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
                <Button variant="ghost" size="icon" onClick={() => navigate('/fitdb/clients')}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-bold text-foreground">{client?.name || 'Расписание тренировок'}</h1>
                  <button
                    onClick={() => navigate(`/fitdb/clients/${clientId}/stats`)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Статистика →
                  </button>
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
          {/* Заголовок календаря */}
          <div className="mb-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  График тренировок
                  {client?.name && (
                    <span className="text-primary ml-2">{client.name}</span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(weekStart, 'd MMMM', { locale: ru })} — {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: ru })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            {/* Left: Weekly Calendar (vertical) */}
            <div className="flex-1">
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
            <div className="w-[420px] shrink-0">
              <div className="sticky top-20">
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  {/* Заголовок и кнопка добавления */}
                  <div className="p-5 border-b border-border/50 bg-gradient-to-b from-muted/50 to-transparent">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Dumbbell size={16} className="text-primary" />
                        </div>
                        Шаблоны тренировок
                        <span className="text-sm font-normal text-muted-foreground">
                          ({filteredWorkouts.length})
                        </span>
                      </h2>
                      <Button
                        size="sm"
                        onClick={() => navigate('/fitdb/templates/new')}
                        className="h-9 shadow-sm"
                      >
                        <Plus size={16} className="mr-1.5" />
                        Создать
                      </Button>
                    </div>

                    {/* Фильтр по тегам */}
                    {allTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedTag(null)}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                            selectedTag === null
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                          }`}
                        >
                          Все
                        </button>
                        {allTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                            className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                              selectedTag === tag
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Список тренировок */}
                  <div className="p-4 space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto">
                    {filteredWorkouts.length > 0 ? (
                      filteredWorkouts.map((workout) => (
                        <DraggableWorkout
                          key={workout.id}
                          workout={workout}
                          onEditTags={setEditingTagsWorkout}
                          onEditTemplate={(id) => navigate(`/fitdb/templates/${id}`)}
                        />
                      ))
                    ) : (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                          <Dumbbell className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {selectedTag ? 'Нет тренировок с этим тегом' : 'Нет шаблонов тренировок'}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/fitdb/templates/new')}
                        >
                          <Plus size={14} className="mr-1" />
                          Создать шаблон
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Подсказка */}
                  <div className="p-4 border-t border-border/50 bg-gradient-to-t from-muted/30 to-transparent">
                    <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
                      <GripVertical size={14} />
                      Перетащите тренировку на день в календаре
                    </p>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0 bg-muted/30">
            <DialogTitle className="flex items-center gap-4 text-xl mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Dumbbell className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block font-bold">{editingAssignment?.workoutName}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Назначено на {editingAssignment?.dueDate && format(new Date(editingAssignment.dueDate), 'd MMMM yyyy', { locale: ru })}
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Редактирование упражнений назначенной тренировки
            </DialogDescription>

            {/* Сводка по тренировке */}
            {!editingLoading && editingExercises.length > 0 && (() => {
              const timeBasedCategories = ['cardio', 'warmup', 'cooldown', 'flexibility']

              // Подсчёт статистики
              const strengthCount = editingExercises.filter(ex => !timeBasedCategories.includes(ex.exercise.category || '')).length
              const cardioCount = editingExercises.filter(ex => ex.exercise.category === 'cardio').length
              const warmupCount = editingExercises.filter(ex => ex.exercise.category === 'warmup').length
              const cooldownCount = editingExercises.filter(ex => ex.exercise.category === 'cooldown').length
              const flexibilityCount = editingExercises.filter(ex => ex.exercise.category === 'flexibility').length

              // Расчёт времени
              let totalTime = 0
              editingExercises.forEach(ex => {
                if (timeBasedCategories.includes(ex.exercise.category || '')) {
                  totalTime += ex.durationSeconds || 0
                } else {
                  // Силовые: примерно 45 сек на подход + отдых
                  totalTime += (ex.sets * 45) + ((ex.sets - 1) * ex.restSeconds)
                }
              })
              const totalMinutes = Math.round(totalTime / 60)

              // Общее количество подходов
              const totalSets = editingExercises.reduce((acc, ex) => {
                if (!timeBasedCategories.includes(ex.exercise.category || '')) {
                  return acc + ex.sets
                }
                return acc
              }, 0)

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-4 border-b border-border/50">
                  {/* Время */}
                  <div className="bg-violet-500/10 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Clock size={16} className="text-violet-500" />
                      <span className="text-xl font-bold text-foreground">{totalMinutes}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">минут</p>
                  </div>

                  {/* Упражнений */}
                  <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Target size={16} className="text-blue-500" />
                      <span className="text-xl font-bold text-foreground">{editingExercises.length}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium">упражнений</p>
                  </div>

                  {/* Подходов */}
                  {totalSets > 0 && (
                    <div className="bg-orange-500/10 rounded-xl p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Zap size={16} className="text-orange-500" />
                        <span className="text-xl font-bold text-foreground">{totalSets}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium">подходов</p>
                    </div>
                  )}

                  {/* Тип тренировки */}
                  <div className="bg-green-500/10 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Heart size={16} className="text-green-500" />
                    </div>
                    <div className="flex flex-wrap justify-center gap-1">
                      {strengthCount > 0 && (
                        <span className="text-[10px] bg-orange-500/20 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded">
                          💪{strengthCount}
                        </span>
                      )}
                      {cardioCount > 0 && (
                        <span className="text-[10px] bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                          🏃{cardioCount}
                        </span>
                      )}
                      {warmupCount > 0 && (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded">
                          🔥{warmupCount}
                        </span>
                      )}
                      {cooldownCount > 0 && (
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded">
                          ❄️{cooldownCount}
                        </span>
                      )}
                      {flexibilityCount > 0 && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                          🧘{flexibilityCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </DialogHeader>

          {editingLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <DndContext sensors={exerciseSensors} collisionDetection={closestCenter} onDragEnd={handleExerciseDragEnd}>
                <SortableContext items={editingExercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
              {editingExercises.map((ex) => {
                const timeBasedCategories = ['cardio', 'warmup', 'cooldown', 'flexibility']
                const isTimeBased = timeBasedCategories.includes(ex.exercise.category || '')
                const isCardio = ex.exercise.category === 'cardio'

                return (
                  <SortableExerciseItem key={ex.id} id={ex.id}>
                    {({ dragHandleProps }) => (
                  <div
                    className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors"
                  >
                    {/* Заголовок упражнения */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-4">
                        <div
                          {...dragHandleProps}
                          className="cursor-grab active:cursor-grabbing p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                          <GripVertical className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                          {isTimeBased ? '🏃' : '💪'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-foreground">{ex.exercise.name}</h3>
                          <p className="text-sm text-muted-foreground">{ex.exercise.muscleGroup}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeExercise(ex.id)}
                        className="w-10 h-10 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Параметры упражнения */}
                    {isTimeBased ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {/* Время */}
                        <div className="bg-muted/50 rounded-xl p-4">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Время
                          </label>
                          <div className="flex items-center justify-between mt-2">
                            <button
                              onClick={() => updateExercise(ex.id, {
                                durationSeconds: Math.max(60, (ex.durationSeconds || 0) - 60)
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            <div className="text-center">
                              <span className="text-2xl font-bold text-foreground">
                                {Math.round((ex.durationSeconds || 0) / 60)}
                              </span>
                              <span className="text-sm text-muted-foreground ml-1">мин</span>
                            </div>
                            <button
                              onClick={() => updateExercise(ex.id, {
                                durationSeconds: (ex.durationSeconds || 0) + 60
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Дистанция (только для кардио) */}
                        {isCardio && (
                          <div className="bg-muted/50 rounded-xl p-4">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Дистанция
                            </label>
                            <div className="flex items-center justify-between mt-2">
                              <button
                                onClick={() => updateExercise(ex.id, {
                                  distanceMeters: Math.max(0, (ex.distanceMeters || 0) - 500)
                                })}
                                className="w-12 h-12 rounded-xl bg-background border border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center transition-all active:scale-95"
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                              <div className="text-center">
                                <span className="text-2xl font-bold text-foreground">
                                  {((ex.distanceMeters || 0) / 1000).toFixed(1)}
                                </span>
                                <span className="text-sm text-muted-foreground ml-1">км</span>
                              </div>
                              <button
                                onClick={() => updateExercise(ex.id, {
                                  distanceMeters: (ex.distanceMeters || 0) + 500
                                })}
                                className="w-12 h-12 rounded-xl bg-background border border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center transition-all active:scale-95"
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Отдых */}
                        <div className="bg-muted/50 rounded-xl p-4">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Отдых
                          </label>
                          <div className="flex items-center justify-between mt-2">
                            <button
                              onClick={() => updateExercise(ex.id, {
                                restSeconds: Math.max(0, ex.restSeconds - 15)
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            <div className="text-center">
                              <span className="text-2xl font-bold text-foreground">{ex.restSeconds}</span>
                              <span className="text-sm text-muted-foreground ml-1">сек</span>
                            </div>
                            <button
                              onClick={() => updateExercise(ex.id, {
                                restSeconds: ex.restSeconds + 15
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* Подходы */}
                        <div className="bg-blue-500/10 rounded-xl p-4">
                          <label className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                            Подходы
                          </label>
                          <div className="flex items-center justify-between mt-2">
                            <button
                              onClick={() => updateExercise(ex.id, {
                                sets: Math.max(1, ex.sets - 1)
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-blue-500/50 hover:bg-blue-500/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            <span className="text-3xl font-bold text-foreground">{ex.sets}</span>
                            <button
                              onClick={() => updateExercise(ex.id, { sets: ex.sets + 1 })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-blue-500/50 hover:bg-blue-500/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Повторы */}
                        <div className="bg-green-500/10 rounded-xl p-4">
                          <label className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                            Повторы
                          </label>
                          <div className="flex items-center justify-between mt-2">
                            <button
                              onClick={() => updateExercise(ex.id, {
                                reps: Math.max(1, ex.reps - 1)
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-green-500/50 hover:bg-green-500/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            <span className="text-3xl font-bold text-foreground">{ex.reps}</span>
                            <button
                              onClick={() => updateExercise(ex.id, { reps: ex.reps + 1 })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-green-500/50 hover:bg-green-500/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Вес */}
                        <div className="bg-orange-500/10 rounded-xl p-4">
                          <label className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                            Вес
                          </label>
                          <div className="flex items-center justify-between mt-2">
                            <button
                              onClick={() => updateExercise(ex.id, {
                                weightKg: Math.max(0, (ex.weightKg || 0) - 2.5)
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-orange-500/50 hover:bg-orange-500/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            <div className="text-center">
                              <span className="text-2xl font-bold text-foreground">
                                {ex.weightKg || 0}
                              </span>
                              <span className="text-sm text-muted-foreground ml-1">кг</span>
                            </div>
                            <button
                              onClick={() => updateExercise(ex.id, {
                                weightKg: (ex.weightKg || 0) + 2.5
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-orange-500/50 hover:bg-orange-500/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Отдых */}
                        <div className="bg-purple-500/10 rounded-xl p-4">
                          <label className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                            Отдых
                          </label>
                          <div className="flex items-center justify-between mt-2">
                            <button
                              onClick={() => updateExercise(ex.id, {
                                restSeconds: Math.max(0, ex.restSeconds - 15)
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-purple-500/50 hover:bg-purple-500/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                            <div className="text-center">
                              <span className="text-2xl font-bold text-foreground">{ex.restSeconds}</span>
                              <span className="text-sm text-muted-foreground ml-1">сек</span>
                            </div>
                            <button
                              onClick={() => updateExercise(ex.id, {
                                restSeconds: ex.restSeconds + 15
                              })}
                              className="w-12 h-12 rounded-xl bg-background border border-border hover:border-purple-500/50 hover:bg-purple-500/5 flex items-center justify-center transition-all active:scale-95"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                    )}
                  </SortableExerciseItem>
                )
              })}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Кнопка добавления упражнения */}
              <button
                onClick={() => {
                  setExerciseSelectorOpen(true)
                  searchExercises('')
                }}
                className="w-full mt-4 py-5 border-2 border-dashed border-border hover:border-primary/50 rounded-2xl flex items-center justify-center gap-3 text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="w-6 h-6" />
                <span className="font-medium">Добавить упражнение</span>
              </button>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="flex gap-4 px-6 py-5 border-t bg-muted/30">
            <Button
              variant="outline"
              className="flex-1 h-12 text-base"
              onClick={() => setEditingAssignment(null)}
            >
              Отмена
            </Button>
            <Button
              className="flex-1 h-12 text-base"
              onClick={handleSaveEditedWorkout}
              disabled={saving || editingExercises.length === 0}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              Сохранить для клиента
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог выбора упражнения */}
      <Dialog open={exerciseSelectorOpen} onOpenChange={setExerciseSelectorOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl">Добавить упражнение</DialogTitle>
            <DialogDescription className="sr-only">
              Поиск и добавление упражнения в тренировку
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pt-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Поиск упражнений..."
                value={exerciseSearchQuery}
                onChange={(e) => {
                  setExerciseSearchQuery(e.target.value)
                  searchExercises(e.target.value)
                }}
                className="pl-12 h-12 text-base rounded-xl"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {exerciseSearchLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : availableExercises.length > 0 ? (
              availableExercises
                .filter((e) => !editingExercises.some((ex) => ex.exerciseId === e.id))
                .map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => addExerciseToWorkout(exercise)}
                    className="w-full p-4 rounded-xl bg-muted/50 hover:bg-primary/5 border border-border hover:border-primary/50 transition-all text-left flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-xl transition-colors">
                      💪
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{exercise.name}</p>
                      <p className="text-sm text-muted-foreground">{exercise.muscleGroup}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary text-primary group-hover:text-white flex items-center justify-center transition-colors">
                      <Plus className="w-5 h-5" />
                    </div>
                  </button>
                ))
            ) : (
              <div className="text-center py-12">
                <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {exerciseSearchQuery ? 'Упражнения не найдены' : 'Введите название для поиска'}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования тегов */}
      <Dialog open={!!editingTagsWorkout} onOpenChange={(open) => !open && setEditingTagsWorkout(null)}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="block">Теги тренировки</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {editingTagsWorkout?.name}
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Управление тегами шаблона тренировки
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {/* Текущие теги */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Текущие теги
              </label>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {editingTagsWorkout?.tags && editingTagsWorkout.tags.length > 0 ? (
                  editingTagsWorkout.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full"
                    >
                      {tag}
                      <button
                        onClick={() => removeTagFromWorkout(tag)}
                        className="w-4 h-4 rounded-full hover:bg-primary/20 flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Нет тегов</span>
                )}
              </div>
            </div>

            {/* Добавить новый тег */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Добавить тег
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Введите новый тег..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagInput.trim()) {
                      addTagToWorkout(newTagInput.trim())
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => newTagInput.trim() && addTagToWorkout(newTagInput.trim())}
                  disabled={!newTagInput.trim()}
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            {/* Быстрый выбор из существующих тегов */}
            {allTags.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Или выберите существующий
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allTags
                    .filter((tag) => !editingTagsWorkout?.tags?.includes(tag))
                    .map((tag) => (
                      <button
                        key={tag}
                        onClick={() => addTagToWorkout(tag)}
                        className="text-xs px-2.5 py-1.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <Plus size={12} />
                        {tag}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t bg-muted/30">
            <Button
              className="w-full"
              onClick={() => setEditingTagsWorkout(null)}
            >
              <Check size={16} className="mr-2" />
              Готово
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}
