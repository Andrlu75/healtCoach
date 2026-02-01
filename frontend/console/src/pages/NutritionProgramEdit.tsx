import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronRight, Save, Play, X, Copy, Plus, Check, Loader2, ShoppingCart, Sparkles, ArrowLeft } from 'lucide-react'
import { nutritionProgramsApi } from '../api/nutritionPrograms'
import { clientsApi } from '../api/clients'
import type {
  NutritionProgram,
  NutritionProgramCreatePayload,
  Ingredient,
  Client,
  ProgramMeal,
  MealType,
  ShoppingListItem,
} from '../types'

interface DayFormData {
  day_number: number
  meals: ProgramMeal[]
  activity: string
  allowed_ingredients: Ingredient[]
  forbidden_ingredients: Ingredient[]
  shopping_list: ShoppingListItem[]
  notes: string
}

const MEAL_TYPES: { type: MealType; label: string; defaultTime: string }[] = [
  { type: 'breakfast', label: 'Завтрак', defaultTime: '08:00' },
  { type: 'snack1', label: 'Перекус 1', defaultTime: '11:00' },
  { type: 'lunch', label: 'Обед', defaultTime: '13:00' },
  { type: 'snack2', label: 'Перекус 2', defaultTime: '16:00' },
  { type: 'dinner', label: 'Ужин', defaultTime: '19:00' },
]

const SHOPPING_CATEGORIES: { key: ShoppingListItem['category']; label: string; emoji: string }[] = [
  { key: 'vegetables', label: 'Овощи и фрукты', emoji: '🥬' },
  { key: 'meat', label: 'Мясо и рыба', emoji: '🥩' },
  { key: 'dairy', label: 'Молочные продукты', emoji: '🥛' },
  { key: 'grains', label: 'Крупы и гарниры', emoji: '🌾' },
  { key: 'other', label: 'Прочее', emoji: '🛒' },
]

export default function NutritionProgramEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [activeSection, setActiveSection] = useState<'general' | number>('general')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const allowNavigationRef = useRef(false)

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
    }).catch(console.error)

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
              shopping_list: d.shopping_list || [],
              notes: d.notes,
            }))
          )
        }
      }).catch((err) => {
        console.error('Failed to load program:', err)
      }).finally(() => {
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
            shopping_list: [],
            notes: '',
          }
        )
      }
      setDays(newDays)
    }
  }, [formData.duration_days, isNew])

  const autoSave = useCallback(async () => {
    if (isNew || !id) return

    setAutoSaving(true)
    try {
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
          shopping_list: d.shopping_list,
          notes: d.notes,
        })),
      })
      setLastSaved(new Date())
      setHasUnsavedChanges(false)
    } catch (err) {
      console.error('Autosave failed:', err)
    } finally {
      setAutoSaving(false)
    }
  }, [isNew, id, formData, days])

  const triggerAutoSave = useCallback(() => {
    setHasUnsavedChanges(true)
    if (isNew) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSave()
    }, 1000)
  }, [isNew, autoSave])

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !allowNavigationRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const handleFormChange = useCallback((field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
    triggerAutoSave()
  }, [triggerAutoSave])

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
            shopping_list: d.shopping_list,
            notes: d.notes,
          })),
        }
        const { data } = await nutritionProgramsApi.create(payload)
        if (activate) {
          await nutritionProgramsApi.activate(data.id)
        }
        allowNavigationRef.current = true
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
            shopping_list: d.shopping_list,
            notes: d.notes,
          })),
        })
        if (activate && program?.status === 'draft') {
          await nutritionProgramsApi.activate(Number(id))
        }
        allowNavigationRef.current = true
        navigate('/nutrition-programs')
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: Record<string, unknown> } }
      const data = axiosError.response?.data
      let message = 'Ошибка сохранения'

      if (data) {
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
    triggerAutoSave()
  }

  const addIngredient = (dayNumber: number, type: 'allowed' | 'forbidden', name: string) => {
    if (!name.trim()) return
    const key = type === 'allowed' ? 'allowed_ingredients' : 'forbidden_ingredients'
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === dayNumber
          ? { ...d, [key]: [...d[key], { name: name.trim() }] }
          : d
      )
    )
    triggerAutoSave()
  }

  const removeIngredient = (dayNumber: number, type: 'allowed' | 'forbidden', index: number) => {
    const key = type === 'allowed' ? 'allowed_ingredients' : 'forbidden_ingredients'
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === dayNumber
          ? { ...d, [key]: d[key].filter((_, i) => i !== index) }
          : d
      )
    )
    triggerAutoSave()
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
              shopping_list: [...sourceDay.shopping_list],
              notes: sourceDay.notes,
            }
      )
    )
    triggerAutoSave()
  }

  const copyFromPreviousDay = (dayNumber: number) => {
    const prevDay = days.find((d) => d.day_number === dayNumber - 1)
    if (!prevDay) return
    updateDay(dayNumber, {
      meals: prevDay.meals.map((m) => ({ ...m })),
      activity: prevDay.activity,
      allowed_ingredients: [...prevDay.allowed_ingredients],
      forbidden_ingredients: [...prevDay.forbidden_ingredients],
      shopping_list: [...prevDay.shopping_list],
      notes: prevDay.notes,
    })
  }

  const addMeal = (dayNumber: number, meal: ProgramMeal) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === dayNumber ? { ...d, meals: [...d.meals, meal] } : d
      )
    )
    triggerAutoSave()
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
    triggerAutoSave()
  }

  const removeMeal = (dayNumber: number, mealIndex: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.day_number === dayNumber
          ? { ...d, meals: d.meals.filter((_, i) => i !== mealIndex) }
          : d
      )
    )
    triggerAutoSave()
  }

  const getDayDate = (dayNumber: number) => {
    if (!formData.start_date) return null
    return new Date(new Date(formData.start_date).getTime() + (dayNumber - 1) * 86400000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const currentDay = typeof activeSection === 'number'
    ? days.find((d) => d.day_number === activeSection)
    : null
  const currentDayIndex = typeof activeSection === 'number'
    ? days.findIndex((d) => d.day_number === activeSection)
    : -1

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Compact Header */}
      <div className="flex-shrink-0 border-b border-border bg-card px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                allowNavigationRef.current = true
                navigate('/nutrition-programs')
              }}
              className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
                <Link to="/nutrition-programs" className="hover:text-foreground">
                  Программы питания
                </Link>
                <ChevronRight size={12} />
                <span>{isNew ? 'Новая' : 'Редактирование'}</span>
              </div>
              <h1 className="text-lg font-semibold text-foreground">
                {formData.name || 'Новая программа питания'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Save status */}
            {!isNew && (
              <span className="text-xs text-muted-foreground">
                {autoSaving ? (
                  <span className="flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    Сохранение...
                  </span>
                ) : lastSaved ? (
                  <span className="flex items-center gap-1 text-green-500">
                    <Check size={12} />
                    {lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </span>
            )}

            <button
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
            >
              <Save size={16} />
              Сохранить
            </button>

            {(isNew || program?.status === 'draft') && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
              >
                <Play size={16} />
                Активировать
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-56 flex-shrink-0 border-r border-border bg-card/50 overflow-y-auto">
          <div className="p-3">
            {/* General section */}
            <button
              type="button"
              onClick={() => setActiveSection('general')}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                activeSection === 'general'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              Основные настройки
            </button>

            {/* Days section header */}
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4 mb-1">
              Дни программы
            </div>

            {/* Days list */}
            <div className="space-y-0.5">
              {days.map((day) => {
                const dayDate = getDayDate(day.day_number)
                const isActive = activeSection === day.day_number
                const hasMeals = day.meals.length > 0
                const hasShoppingList = day.shopping_list.length > 0

                return (
                  <button
                    key={day.day_number}
                    type="button"
                    onClick={() => setActiveSection(day.day_number)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-sm ${isActive ? 'font-medium' : ''}`}>
                          День {day.day_number}
                        </span>
                        {dayDate && (
                          <span className="block text-xs opacity-70">
                            {dayDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {hasMeals && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            isActive ? 'bg-primary/20' : 'bg-green-500/20 text-green-500'
                          }`}>
                            {day.meals.length}
                          </span>
                        )}
                        {hasShoppingList && (
                          <ShoppingCart size={12} className={isActive ? '' : 'text-orange-400'} />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* General Settings */}
            {activeSection === 'general' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-foreground">Основные настройки</h2>

                {/* Form fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Клиент
                    </label>
                    <select
                      value={formData.client}
                      onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                      disabled={!isNew}
                      className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:opacity-50"
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
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Название программы
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      placeholder="Детокс-программа на неделю"
                      className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Дата начала
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      disabled={!isNew}
                      className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Количество дней
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={formData.duration_days}
                      onChange={(e) => setFormData({ ...formData, duration_days: Number(e.target.value) })}
                      disabled={!isNew}
                      className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Описание программы
                  </label>
                  <AutoResizeTextarea
                    value={formData.description}
                    onChange={(value) => handleFormChange('description', value)}
                    placeholder="Опишите цели и особенности программы..."
                    minRows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Общие рекомендации
                  </label>
                  <AutoResizeTextarea
                    value={formData.general_notes}
                    onChange={(value) => handleFormChange('general_notes', value)}
                    placeholder="Рекомендации на всю программу: режим питья, сна, активности..."
                    minRows={3}
                  />
                </div>

                {/* Days overview */}
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Обзор дней</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {days.map((day) => {
                      const dayDate = getDayDate(day.day_number)
                      return (
                        <button
                          key={day.day_number}
                          type="button"
                          onClick={() => setActiveSection(day.day_number)}
                          className={`p-3 rounded-lg border text-center transition-colors ${
                            day.meals.length > 0
                              ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                              : 'border-border bg-card hover:bg-muted'
                          }`}
                        >
                          <div className="text-lg font-semibold text-foreground">{day.day_number}</div>
                          {dayDate && (
                            <div className="text-xs text-muted-foreground">
                              {dayDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {day.meals.length} блюд
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Day Content */}
            {currentDay && (
              <DayEditor
                day={currentDay}
                dayId={program?.days?.[currentDayIndex]?.id}
                programId={program?.id}
                dayDate={getDayDate(currentDay.day_number)}
                onUpdate={(updates) => updateDay(currentDay.day_number, updates)}
                onAddIngredient={(type, name) => addIngredient(currentDay.day_number, type, name)}
                onRemoveIngredient={(type, index) => removeIngredient(currentDay.day_number, type, index)}
                onAddMeal={(meal) => addMeal(currentDay.day_number, meal)}
                onUpdateMeal={(index, updates) => updateMeal(currentDay.day_number, index, updates)}
                onRemoveMeal={(index) => removeMeal(currentDay.day_number, index)}
                onCopyToAll={() => copyToAllDays(currentDay.day_number)}
                onCopyFromPrevious={currentDay.day_number > 1 ? () => copyFromPreviousDay(currentDay.day_number) : undefined}
                onPrevDay={currentDay.day_number > 1 ? () => setActiveSection(currentDay.day_number - 1) : undefined}
                onNextDay={currentDay.day_number < days.length ? () => setActiveSection(currentDay.day_number + 1) : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Auto-resize textarea component
function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  minRows = 1,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minRows?: number
  className?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  useEffect(() => {
    adjustHeight()
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
        adjustHeight()
      }}
      placeholder={placeholder}
      rows={minRows}
      className={`w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none resize-none overflow-hidden ${className}`}
    />
  )
}

// Get word stem (first N chars for Russian fuzzy matching)
function getWordStem(word: string): string {
  const normalized = word.toLowerCase().trim()
  // For short words (<=4 chars), use the whole word
  if (normalized.length <= 4) return normalized
  // For longer words, take first 4-5 chars as stem
  // But try to avoid cutting in the middle of common suffixes
  const len = normalized.length
  if (len >= 6) return normalized.slice(0, Math.min(5, len - 2))
  return normalized.slice(0, 4)
}

// Check if two words match (fuzzy for Russian)
function wordsMatch(textWord: string, productWord: string): boolean {
  const textLower = textWord.toLowerCase()
  const productLower = productWord.toLowerCase()

  // Exact match
  if (textLower === productLower) return true

  // One contains the other (for compound words)
  if (textLower.includes(productLower) || productLower.includes(textLower)) {
    // Only if the shorter one is at least 3 chars
    const shorter = textLower.length < productLower.length ? textLower : productLower
    if (shorter.length >= 3) return true
  }

  // Stem matching - same root
  const textStem = getWordStem(textLower)
  const productStem = getWordStem(productLower)
  if (textStem.length >= 3 && productStem.length >= 3) {
    if (textStem === productStem) return true
    // Check if one stem starts with the other
    if (textStem.startsWith(productStem) || productStem.startsWith(textStem)) return true
  }

  return false
}

// Text with product highlighting
function HighlightedMealDescription({
  value,
  onChange,
  placeholder,
  highlightWords,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  highlightWords: Set<string>
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  useEffect(() => {
    adjustHeight()
  }, [value])

  // Create highlighted text parts with fuzzy matching
  const renderHighlightedText = () => {
    if (highlightWords.size === 0 || !value) return value || placeholder || ''

    // Split text into words and non-words (preserve punctuation, spaces)
    const parts = value.split(/(\s+|[,.;:!?()"\-—–]+)/)

    return parts.map((part, i) => {
      // Skip whitespace and punctuation
      if (!part.trim() || /^[\s,.;:!?()"\-—–]+$/.test(part)) {
        return part
      }

      // Check if this word matches any of the highlighted products
      const isHighlighted = Array.from(highlightWords).some(product =>
        wordsMatch(part, product)
      )

      if (isHighlighted) {
        return (
          <mark key={i} className="bg-orange-500 text-white rounded px-0.5 py-0.5">
            {part}
          </mark>
        )
      }
      return part
    })
  }

  // Show textarea when focused, highlighted text when not focused and there's a highlight
  if (!isFocused && highlightWords.size > 0 && value) {
    return (
      <div
        onClick={() => {
          setIsFocused(true)
          setTimeout(() => textareaRef.current?.focus(), 0)
        }}
        className="w-full px-3 py-2 text-sm bg-background text-foreground border border-border rounded-lg cursor-text whitespace-pre-wrap"
        style={{ minHeight: '2.5rem' }}
      >
        {renderHighlightedText()}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            adjustHeight()
          }}
          className="hidden"
        />
      </div>
    )
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
        adjustHeight()
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      placeholder={placeholder}
      rows={1}
      className="w-full px-3 py-2 text-sm bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none resize-none overflow-hidden"
      style={{ minHeight: '2.5rem' }}
    />
  )
}

// Day Editor Component
interface DayEditorProps {
  day: DayFormData
  dayId?: number
  programId?: number
  dayDate: Date | null
  onUpdate: (updates: Partial<DayFormData>) => void
  onAddIngredient: (type: 'allowed' | 'forbidden', name: string) => void
  onRemoveIngredient: (type: 'allowed' | 'forbidden', index: number) => void
  onAddMeal: (meal: ProgramMeal) => void
  onUpdateMeal: (index: number, meal: Partial<ProgramMeal>) => void
  onRemoveMeal: (index: number) => void
  onCopyToAll: () => void
  onCopyFromPrevious?: () => void
  onPrevDay?: () => void
  onNextDay?: () => void
}

function DayEditor({
  day,
  dayId,
  programId,
  dayDate,
  onUpdate,
  onAddIngredient,
  onRemoveIngredient,
  onAddMeal,
  onUpdateMeal,
  onRemoveMeal,
  onCopyToAll,
  onCopyFromPrevious,
  onPrevDay,
  onNextDay,
}: DayEditorProps) {
  const [newMealType, setNewMealType] = useState<MealType>('breakfast')
  const [showMealForm, setShowMealForm] = useState(false)
  const [generatingList, setGeneratingList] = useState(false)
  const [analyzingProducts, setAnalyzingProducts] = useState(false)
  const [productMapping, setProductMapping] = useState<Record<string, string[]>>({})
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [newShoppingItem, setNewShoppingItem] = useState('')
  const [newShoppingCategory, setNewShoppingCategory] = useState<ShoppingListItem['category']>('other')
  const [newAllowed, setNewAllowed] = useState('')
  const [newForbidden, setNewForbidden] = useState('')
  const [showIngredients, setShowIngredients] = useState(
    day.allowed_ingredients.length > 0 || day.forbidden_ingredients.length > 0
  )

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

  const handleGenerateShoppingList = async () => {
    if (!programId || !dayId) {
      alert('Сначала сохраните программу')
      return
    }
    if (day.meals.length === 0) {
      alert('Добавьте хотя бы один приём пищи')
      return
    }
    setGeneratingList(true)
    try {
      const { data } = await nutritionProgramsApi.generateShoppingList(programId, dayId)
      onUpdate({ shopping_list: data.shopping_list })
      // Сбрасываем маппинг при новом списке
      setProductMapping({})
      setSelectedProducts(new Set())
    } catch (err) {
      console.error('Failed to generate shopping list:', err)
      alert('Не удалось сгенерировать список покупок')
    } finally {
      setGeneratingList(false)
    }
  }

  const handleAnalyzeProducts = async () => {
    if (!programId || !dayId) {
      alert('Сначала сохраните программу')
      return
    }
    if (day.shopping_list.length === 0) {
      alert('Список покупок пуст')
      return
    }
    setAnalyzingProducts(true)
    try {
      const { data } = await nutritionProgramsApi.analyzeProducts(programId, dayId)
      setProductMapping(data.mapping)
      // Автоматически выбираем все продукты
      setSelectedProducts(new Set(Object.keys(data.mapping)))
    } catch (err) {
      console.error('Failed to analyze products:', err)
      alert('Не удалось проанализировать продукты')
    } finally {
      setAnalyzingProducts(false)
    }
  }

  // Получить все слова для подсветки на основе выбранных продуктов
  const getHighlightWords = (): Set<string> => {
    const words = new Set<string>()
    selectedProducts.forEach(product => {
      // Добавляем само название продукта
      words.add(product)
      // Добавляем слова из AI маппинга
      const mappedWords = productMapping[product]
      if (mappedWords) {
        mappedWords.forEach(w => words.add(w))
      }
    })
    return words
  }

  const addShoppingItem = () => {
    if (!newShoppingItem.trim()) return
    const newItem: ShoppingListItem = {
      name: newShoppingItem.trim(),
      category: newShoppingCategory,
    }
    onUpdate({ shopping_list: [...day.shopping_list, newItem] })
    setNewShoppingItem('')
  }

  const removeShoppingItem = (index: number) => {
    onUpdate({ shopping_list: day.shopping_list.filter((_, i) => i !== index) })
  }

  const getItemsByCategory = (category: ShoppingListItem['category']) => {
    return day.shopping_list
      .map((item, index) => ({ ...item, index }))
      .filter((item) => item.category === category)
  }

  const getMealTypeLabel = (type: MealType) => {
    return MEAL_TYPES.find((m) => m.type === type)?.label || type
  }

  return (
    <div>
      {/* Day header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            День {day.day_number}
          </h2>
          {dayDate && (
            <p className="text-sm text-muted-foreground">
              {dayDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCopyFromPrevious && (
            <button
              type="button"
              onClick={onCopyFromPrevious}
              className="flex items-center gap-1.5 text-xs px-2 py-1 text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted"
            >
              <Copy size={12} />
              С предыдущего
            </button>
          )}
          <button
            type="button"
            onClick={onCopyToAll}
            className="flex items-center gap-1.5 text-xs px-2 py-1 text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted"
          >
            <Copy size={12} />
            На все дни
          </button>
          <div className="flex items-center border-l border-border pl-2 ml-1">
            <button
              type="button"
              onClick={onPrevDay}
              disabled={!onPrevDay}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight size={16} className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={onNextDay}
              disabled={!onNextDay}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* Left column - Meals & notes */}
        <div className="flex-1 space-y-4">
          {/* Meals */}
          {day.meals.length > 0 ? (
            <div className="space-y-3">
              {day.meals.map((meal, i) => (
                <div
                  key={meal.id || i}
                  className="bg-card border border-border rounded-lg p-3"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {getMealTypeLabel(meal.type)}
                      </span>
                      <input
                        type="time"
                        value={meal.time}
                        onChange={(e) => onUpdateMeal(i, { time: e.target.value })}
                        className="text-xs px-1.5 py-0.5 bg-background text-foreground border border-border rounded outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveMeal(i)}
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={meal.name}
                    onChange={(e) => onUpdateMeal(i, { name: e.target.value })}
                    placeholder="Название блюда"
                    className="w-full px-2 py-1.5 text-sm bg-background text-foreground border border-border rounded mb-2 outline-none"
                  />

                  <HighlightedMealDescription
                    value={meal.description}
                    onChange={(value) => onUpdateMeal(i, { description: value })}
                    placeholder="Описание блюда и ингредиенты..."
                    highlightWords={getHighlightWords()}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg text-center">
              Приёмы пищи не добавлены
            </div>
          )}

          {showMealForm ? (
            <div className="flex items-center gap-2">
              <select
                value={newMealType}
                onChange={(e) => setNewMealType(e.target.value as MealType)}
                className="px-2 py-1.5 text-sm bg-background text-foreground border border-border rounded outline-none"
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
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Добавить
              </button>
              <button
                type="button"
                onClick={() => setShowMealForm(false)}
                className="px-2 py-1.5 text-sm text-muted-foreground"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMealForm(true)}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
            >
              <Plus size={14} />
              Добавить приём пищи
            </button>
          )}

          {/* Activity & Notes */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Активность
              </label>
              <AutoResizeTextarea
                value={day.activity}
                onChange={(value) => onUpdate({ activity: value })}
                placeholder="Прогулка, йога..."
                minRows={1}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Заметки
              </label>
              <AutoResizeTextarea
                value={day.notes}
                onChange={(value) => onUpdate({ notes: value })}
                placeholder="Рекомендации..."
                minRows={1}
                className="text-sm"
              />
            </div>
          </div>

          {/* Allowed/Forbidden - compact */}
          {showIngredients ? (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-muted/20 border border-border rounded p-2">
                <label className="block text-xs font-medium text-green-400/80 mb-1.5">
                  Разрешённые
                </label>
                {day.allowed_ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {day.allowed_ingredients.map((ing, i) => (
                      <span key={i} className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded">
                        {ing.name}
                        <button type="button" onClick={() => onRemoveIngredient('allowed', i)} className="hover:text-green-200">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newAllowed}
                    onChange={(e) => setNewAllowed(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddIngredient('allowed', newAllowed); setNewAllowed('') }}}
                    placeholder="Добавить..."
                    className="flex-1 px-1.5 py-0.5 text-xs bg-background border border-border rounded outline-none"
                  />
                  <button type="button" onClick={() => { onAddIngredient('allowed', newAllowed); setNewAllowed('') }} className="px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">+</button>
                </div>
              </div>
              <div className="bg-muted/20 border border-border rounded p-2">
                <label className="block text-xs font-medium text-red-400/80 mb-1.5">
                  Запрещённые
                </label>
                {day.forbidden_ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {day.forbidden_ingredients.map((ing, i) => (
                      <span key={i} className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">
                        {ing.name}
                        <button type="button" onClick={() => onRemoveIngredient('forbidden', i)} className="hover:text-red-200">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newForbidden}
                    onChange={(e) => setNewForbidden(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddIngredient('forbidden', newForbidden); setNewForbidden('') }}}
                    placeholder="Добавить..."
                    className="flex-1 px-1.5 py-0.5 text-xs bg-background border border-border rounded outline-none"
                  />
                  <button type="button" onClick={() => { onAddIngredient('forbidden', newForbidden); setNewForbidden('') }} className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded text-xs">+</button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowIngredients(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              + Ограничения по продуктам
            </button>
          )}
        </div>

        {/* Right column - Shopping List (sticky) */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-0 bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShoppingCart size={16} className="text-orange-400" />
                Покупки
              </h3>
              <div className="flex items-center gap-1">
                {selectedProducts.size > 0 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedProducts(new Set()); setProductMapping({}) }}
                    className="text-xs px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAnalyzeProducts}
                  disabled={analyzingProducts || day.shopping_list.length === 0}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 disabled:opacity-50"
                  title="AI найдёт связи между продуктами и текстом"
                >
                  {analyzingProducts ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  Анализ
                </button>
                <button
                  type="button"
                  onClick={handleGenerateShoppingList}
                  disabled={generatingList}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-500/10 text-orange-400 rounded hover:bg-orange-500/20 disabled:opacity-50"
                  title="Сгенерировать список покупок"
                >
                  {generatingList ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Plus size={12} />
                  )}
                  Список
                </button>
              </div>
            </div>

            {day.shopping_list.length > 0 ? (
              <div className="space-y-3 mb-3">
                {SHOPPING_CATEGORIES.map((cat) => {
                  const items = getItemsByCategory(cat.key)
                  if (items.length === 0) return null
                  return (
                    <div key={cat.key}>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        {cat.emoji} {cat.label}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {items.map((item) => {
                          const isSelected = selectedProducts.has(item.name)
                          const mappedCount = productMapping[item.name]?.length || 0
                          const hasMapping = mappedCount > 0
                          return (
                            <span
                              key={item.index}
                              onClick={() => {
                                const newSet = new Set(selectedProducts)
                                if (isSelected) {
                                  newSet.delete(item.name)
                                } else {
                                  newSet.add(item.name)
                                }
                                setSelectedProducts(newSet)
                              }}
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-orange-500 text-white'
                                  : hasMapping
                                  ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                                  : 'bg-muted text-foreground hover:bg-muted/80'
                              }`}
                              title={hasMapping ? `Найдено ${mappedCount} совпадений` : undefined}
                            >
                              {item.name}
                              {hasMapping && !isSelected && (
                                <span className="text-[10px] opacity-70">({mappedCount})</span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeShoppingItem(item.index) }}
                                className={isSelected ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-red-400'}
                              >
                                <X size={10} />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground mb-3 p-2 bg-muted/30 rounded text-center">
                Нажмите «Список» для генерации
              </div>
            )}

            <div className="flex gap-1.5">
              <input
                type="text"
                value={newShoppingItem}
                onChange={(e) => setNewShoppingItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addShoppingItem()
                  }
                }}
                placeholder="Продукт..."
                className="flex-1 px-2 py-1.5 text-xs bg-background text-foreground border border-border rounded outline-none"
              />
              <select
                value={newShoppingCategory}
                onChange={(e) => setNewShoppingCategory(e.target.value as ShoppingListItem['category'])}
                className="px-1.5 py-1.5 text-xs bg-background text-foreground border border-border rounded outline-none w-20"
              >
                {SHOPPING_CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.emoji}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addShoppingItem}
                className="px-2 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
