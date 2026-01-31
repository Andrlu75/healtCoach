import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronRight, Save, Play, X, Copy, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { nutritionProgramsApi } from '../api/nutritionPrograms'
import { clientsApi } from '../api/clients'
import type {
  NutritionProgram,
  NutritionProgramCreatePayload,
  Ingredient,
  Client,
  ProgramMeal,
  MealType,
} from '../types'

interface DayFormData {
  day_number: number
  meals: ProgramMeal[]
  activity: string
  allowed_ingredients: Ingredient[]
  forbidden_ingredients: Ingredient[]
  notes: string
}

const MEAL_TYPES: { type: MealType; label: string; defaultTime: string }[] = [
  { type: 'breakfast', label: 'Завтрак', defaultTime: '08:00' },
  { type: 'snack1', label: 'Перекус 1', defaultTime: '11:00' },
  { type: 'lunch', label: 'Обед', defaultTime: '13:00' },
  { type: 'snack2', label: 'Перекус 2', defaultTime: '16:00' },
  { type: 'dinner', label: 'Ужин', defaultTime: '19:00' },
]

export default function NutritionProgramEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [expandedDay, setExpandedDay] = useState<number | null>(1)

  const [formData, setFormData] = useState({
    client: '',
    name: '',
    description: '',
    general_notes: '',
    start_date: new Date().toISOString().split('T')[0],
    duration_days: 7,
  })

  const [days, setDays] = useState<DayFormData[]>([])
  const [program, setProgram] = useState<NutritionProgram | null>(null)

  useEffect(() => {
    clientsApi.list({ status: 'active' }).then(({ data }) => {
      setClients(data.results || [])
    })

    if (!isNew) {
      nutritionProgramsApi.get(Number(id)).then(({ data }) => {
        setProgram(data)
        setFormData({
          client: String(data.client),
          name: data.name,
          description: data.description,
          general_notes: data.general_notes || '',
          start_date: data.start_date,
          duration_days: data.duration_days,
        })
        if (data.days) {
          setDays(
            data.days.map((d) => ({
              day_number: d.day_number,
              meals: d.meals || [],
              activity: d.activity || '',
              allowed_ingredients: d.allowed_ingredients,
              forbidden_ingredients: d.forbidden_ingredients,
              notes: d.notes,
            }))
          )
        }
        setLoading(false)
      })
    }
  }, [id, isNew])

  useEffect(() => {
    if (isNew && formData.duration_days > 0) {
      const newDays: DayFormData[] = []
      for (let i = 1; i <= formData.duration_days; i++) {
        const existing = days.find((d) => d.day_number === i)
        newDays.push(
          existing || {
            day_number: i,
            meals: [],
            activity: '',
            allowed_ingredients: [],
            forbidden_ingredients: [],
            notes: '',
          }
        )
      }
      setDays(newDays)
    }
  }, [formData.duration_days, isNew])

  const handleSubmit = async (e: React.FormEvent, activate = false) => {
    e.preventDefault()
    if (!formData.client || !formData.name || !formData.start_date) {
      alert('Заполните обязательные поля')
      return
    }

    setSaving(true)
    try {
      if (isNew) {
        const payload: NutritionProgramCreatePayload = {
          client: Number(formData.client),
          name: formData.name,
          description: formData.description,
          general_notes: formData.general_notes,
          start_date: formData.start_date,
          duration_days: formData.duration_days,
          days: days.map((d) => ({
            day_number: d.day_number,
            meals: d.meals,
            activity: d.activity,
            allowed_ingredients: d.allowed_ingredients,
            forbidden_ingredients: d.forbidden_ingredients,
            notes: d.notes,
          })),
        }
        const { data } = await nutritionProgramsApi.create(payload)
        if (activate) {
          await nutritionProgramsApi.activate(data.id)
        }
        navigate(`/nutrition-programs/${data.id}`)
      } else {
        await nutritionProgramsApi.update(Number(id), {
          name: formData.name,
          description: formData.description,
          general_notes: formData.general_notes,
          days: days.map((d) => ({
            day_number: d.day_number,
            meals: d.meals,
            activity: d.activity,
            allowed_ingredients: d.allowed_ingredients,
            forbidden_ingredients: d.forbidden_ingredients,
            notes: d.notes,
          })),
        })
        if (activate && program?.status === 'draft') {
          await nutritionProgramsApi.activate(Number(id))
        }
        navigate('/nutrition-programs')
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: Record<string, unknown> } }
      const data = axiosError.response?.data
      let message = 'Ошибка сохранения'

      if (data) {
        // Пытаемся извлечь сообщение из разных полей
        if (typeof data.start_date === 'string') {
          message = data.start_date
        } else if (Array.isArray(data.start_date)) {
          message = data.start_date[0] as string
        } else if (typeof data.error === 'string') {
          message = data.error
        } else if (typeof data.detail === 'string') {
          message = data.detail
        } else if (typeof data.non_field_errors === 'object' && Array.isArray(data.non_field_errors)) {
          message = data.non_field_errors[0] as string
        }
      }

      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const updateDay = (dayNumber: number, updates: Partial<DayFormData>) => {
    setDays((prev) =>
      prev.map((d) => (d.day_number === dayNumber ? { ...d, ...updates } : d))
    )
  }

  const addIngredient = (
    dayNumber: number,
    type: 'allowed' | 'forbidden',
    name: string
  ) => {
    if (!name.trim()) return
    const key = type === 'allowed' ? 'allowed_ingredients' : 'forbidden_ingredients'
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === dayNumber
          ? { ...d, [key]: [...d[key], { name: name.trim() }] }
          : d
      )
    )
  }

  const removeIngredient = (
    dayNumber: number,
    type: 'allowed' | 'forbidden',
    index: number
  ) => {
    const key = type === 'allowed' ? 'allowed_ingredients' : 'forbidden_ingredients'
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === dayNumber
          ? { ...d, [key]: d[key].filter((_, i) => i !== index) }
          : d
      )
    )
  }

  const copyToAllDays = (sourceDayNumber: number) => {
    const sourceDay = days.find((d) => d.day_number === sourceDayNumber)
    if (!sourceDay) return
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === sourceDayNumber
          ? d
          : {
              ...d,
              meals: sourceDay.meals.map((m) => ({ ...m })),
              activity: sourceDay.activity,
              allowed_ingredients: [...sourceDay.allowed_ingredients],
              forbidden_ingredients: [...sourceDay.forbidden_ingredients],
              notes: sourceDay.notes,
            }
      )
    )
  }

  const copyFromPreviousDay = (dayNumber: number) => {
    const prevDay = days.find((d) => d.day_number === dayNumber - 1)
    if (!prevDay) return
    updateDay(dayNumber, {
      meals: prevDay.meals.map((m) => ({ ...m })),
      activity: prevDay.activity,
      allowed_ingredients: [...prevDay.allowed_ingredients],
      forbidden_ingredients: [...prevDay.forbidden_ingredients],
      notes: prevDay.notes,
    })
  }

  const addMeal = (dayNumber: number, meal: ProgramMeal) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === dayNumber ? { ...d, meals: [...d.meals, meal] } : d
      )
    )
  }

  const updateMeal = (dayNumber: number, mealIndex: number, updates: Partial<ProgramMeal>) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === dayNumber
          ? {
              ...d,
              meals: d.meals.map((m, i) => (i === mealIndex ? { ...m, ...updates } : m)),
            }
          : d
      )
    )
  }

  const removeMeal = (dayNumber: number, mealIndex: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === dayNumber
          ? { ...d, meals: d.meals.filter((_, i) => i !== mealIndex) }
          : d
      )
    )
  }

  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  return (
    <div className="max-w-4xl">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/nutrition-programs" className="hover:text-foreground">
          Программы питания
        </Link>
        <ChevronRight size={14} />
        <span className="text-foreground">
          {isNew ? 'Новая программа' : program?.name}
        </span>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {isNew ? 'Новая программа питания' : 'Редактирование программы'}
          </h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/nutrition-programs')}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X size={18} />
              <span className="hidden sm:inline">Отмена</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={18} />
              <span className="hidden sm:inline">Сохранить</span>
            </button>
            {(isNew || program?.status === 'draft') && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Play size={18} />
                <span className="hidden sm:inline">Активировать</span>
              </button>
            )}
          </div>
        </div>

        {/* Basic info */}
        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Основная информация</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Клиент *
              </label>
              <select
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                disabled={!isNew}
                className="w-full px-3 py-2 bg-[#141821] text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
              >
                <option value="">Выберите клиента</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.telegram_username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Название *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Детокс-программа"
                className="w-full px-3 py-2 bg-[#141821] text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Дата начала *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                disabled={!isNew}
                className="w-full px-3 py-2 bg-[#141821] text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Количество дней *
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={formData.duration_days}
                onChange={(e) =>
                  setFormData({ ...formData, duration_days: Number(e.target.value) })
                }
                disabled={!isNew}
                className="w-full px-3 py-2 bg-[#141821] text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Описание
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Описание программы..."
                className="w-full px-3 py-2 bg-[#141821] text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Общие заметки
              </label>
              <textarea
                value={formData.general_notes}
                onChange={(e) => setFormData({ ...formData, general_notes: e.target.value })}
                rows={3}
                placeholder="Общие рекомендации на всю программу: про воду, режим сна, кофе и т.д."
                className="w-full px-3 py-2 bg-[#141821] text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Days */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Дни программы</h2>
          <div className="space-y-3">
            {days.map((day) => (
              <DayCard
                key={day.day_number}
                day={day}
                expanded={expandedDay === day.day_number}
                onToggle={() =>
                  setExpandedDay(expandedDay === day.day_number ? null : day.day_number)
                }
                onUpdate={(updates) => updateDay(day.day_number, updates)}
                onAddIngredient={(type, name) =>
                  addIngredient(day.day_number, type, name)
                }
                onRemoveIngredient={(type, index) =>
                  removeIngredient(day.day_number, type, index)
                }
                onAddMeal={(meal) => addMeal(day.day_number, meal)}
                onUpdateMeal={(index, updates) => updateMeal(day.day_number, index, updates)}
                onRemoveMeal={(index) => removeMeal(day.day_number, index)}
                onCopyToAll={() => copyToAllDays(day.day_number)}
                onCopyFromPrevious={
                  day.day_number > 1 ? () => copyFromPreviousDay(day.day_number) : undefined
                }
              />
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}

interface DayCardProps {
  day: DayFormData
  expanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<DayFormData>) => void
  onAddIngredient: (type: 'allowed' | 'forbidden', name: string) => void
  onRemoveIngredient: (type: 'allowed' | 'forbidden', index: number) => void
  onAddMeal: (meal: ProgramMeal) => void
  onUpdateMeal: (index: number, meal: Partial<ProgramMeal>) => void
  onRemoveMeal: (index: number) => void
  onCopyToAll: () => void
  onCopyFromPrevious?: () => void
}

function DayCard({
  day,
  expanded,
  onToggle,
  onUpdate,
  onAddIngredient,
  onRemoveIngredient,
  onAddMeal,
  onUpdateMeal,
  onRemoveMeal,
  onCopyToAll,
  onCopyFromPrevious,
}: DayCardProps) {
  const [newAllowed, setNewAllowed] = useState('')
  const [newForbidden, setNewForbidden] = useState('')
  const [showMealForm, setShowMealForm] = useState(false)
  const [newMealType, setNewMealType] = useState<MealType>('breakfast')

  const handleAddMeal = () => {
    const mealConfig = MEAL_TYPES.find((m) => m.type === newMealType)
    if (!mealConfig) return
    onAddMeal({
      id: crypto.randomUUID(),
      type: newMealType,
      time: mealConfig.defaultTime,
      name: mealConfig.label,
      description: '',
    })
    setShowMealForm(false)
    setNewMealType('breakfast')
  }

  const getMealTypeLabel = (type: MealType) => {
    return MEAL_TYPES.find((m) => m.type === type)?.label || type
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted/80"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">День {day.day_number}</span>
          <span className="text-xs text-muted-foreground">
            {day.meals.length} приём(ов) · {day.allowed_ingredients.length} разр. / {day.forbidden_ingredients.length} запр.
          </span>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Copy buttons */}
          <div className="flex gap-2 flex-wrap">
            {onCopyFromPrevious && (
              <button
                type="button"
                onClick={onCopyFromPrevious}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-muted rounded text-muted-foreground hover:text-foreground"
              >
                <Copy size={12} />
                С предыдущего дня
              </button>
            )}
            <button
              type="button"
              onClick={onCopyToAll}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-muted rounded text-muted-foreground hover:text-foreground"
            >
              <Copy size={12} />
              На все дни
            </button>
          </div>

          {/* Meals */}
          <div>
            <label className="block text-sm font-medium text-blue-400 mb-2">
              Приёмы пищи
            </label>
            <div className="space-y-2 mb-2">
              {day.meals.map((meal, i) => (
                <div
                  key={meal.id || i}
                  className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-400">
                        {getMealTypeLabel(meal.type)}
                      </span>
                      <input
                        type="time"
                        value={meal.time}
                        onChange={(e) => onUpdateMeal(i, { time: e.target.value })}
                        className="text-xs px-2 py-1 bg-[#141821] text-foreground border border-border rounded outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveMeal(i)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={meal.name}
                    onChange={(e) => onUpdateMeal(i, { name: e.target.value })}
                    placeholder="Название блюда"
                    className="w-full px-3 py-1.5 text-sm bg-[#141821] text-foreground border border-border rounded mb-2 outline-none"
                  />
                  <textarea
                    value={meal.description}
                    onChange={(e) => onUpdateMeal(i, { description: e.target.value })}
                    placeholder="Описание блюда и ингредиенты..."
                    rows={2}
                    className="w-full px-3 py-1.5 text-sm bg-[#141821] text-foreground border border-border rounded outline-none resize-none"
                  />
                </div>
              ))}
            </div>

            {showMealForm ? (
              <div className="flex items-center gap-2">
                <select
                  value={newMealType}
                  onChange={(e) => setNewMealType(e.target.value as MealType)}
                  className="px-3 py-1.5 text-sm bg-[#141821] text-foreground border border-border rounded outline-none"
                >
                  {MEAL_TYPES.map((m) => (
                    <option key={m.type} value={m.type}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMeal}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  onClick={() => setShowMealForm(false)}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowMealForm(true)}
                className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
              >
                <Plus size={16} />
                Добавить приём пищи
              </button>
            )}
          </div>

          {/* Activity */}
          <div>
            <label className="block text-sm font-medium text-purple-400 mb-2">
              Рекомендации по активности
            </label>
            <textarea
              value={day.activity}
              onChange={(e) => onUpdate({ activity: e.target.value })}
              rows={2}
              placeholder="Рекомендации по физической активности на день..."
              className="w-full px-3 py-2 text-sm bg-[#141821] text-foreground border border-border rounded focus:ring-1 focus:ring-purple-500 outline-none resize-none"
            />
          </div>

          {/* Allowed ingredients */}
          <div>
            <label className="block text-sm font-medium text-green-400 mb-2">
              Разрешённые продукты
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {day.allowed_ingredients.map((ing, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-sm px-2 py-1 bg-green-500/20 text-green-400 rounded"
                >
                  {ing.name}
                  <button
                    type="button"
                    onClick={() => onRemoveIngredient('allowed', i)}
                    className="hover:text-green-200"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAllowed}
                onChange={(e) => setNewAllowed(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onAddIngredient('allowed', newAllowed)
                    setNewAllowed('')
                  }
                }}
                placeholder="Добавить продукт..."
                className="flex-1 px-3 py-1.5 text-sm bg-[#141821] text-foreground border border-border rounded focus:ring-1 focus:ring-green-500 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onAddIngredient('allowed', newAllowed)
                  setNewAllowed('')
                }}
                className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Forbidden ingredients */}
          <div>
            <label className="block text-sm font-medium text-red-400 mb-2">
              Запрещённые продукты
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {day.forbidden_ingredients.map((ing, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-sm px-2 py-1 bg-red-500/20 text-red-400 rounded"
                >
                  {ing.name}
                  <button
                    type="button"
                    onClick={() => onRemoveIngredient('forbidden', i)}
                    className="hover:text-red-200"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newForbidden}
                onChange={(e) => setNewForbidden(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onAddIngredient('forbidden', newForbidden)
                    setNewForbidden('')
                  }
                }}
                placeholder="Добавить продукт..."
                className="flex-1 px-3 py-1.5 text-sm bg-[#141821] text-foreground border border-border rounded focus:ring-1 focus:ring-red-500 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onAddIngredient('forbidden', newForbidden)
                  setNewForbidden('')
                }}
                className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Заметки
            </label>
            <textarea
              value={day.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              rows={2}
              placeholder="Заметки для этого дня..."
              className="w-full px-3 py-2 text-sm bg-[#141821] text-foreground border border-border rounded focus:ring-1 focus:ring-primary outline-none resize-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}
