import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Save, Trash2, MapPin, Clock, Send,
  ChevronDown, ChevronRight, Utensils, Activity,
  MessageCircle, Settings, Calendar, Flame, Beef,
  Droplets, Wheat, User, Scale, Ruler, Cake,
  Brain, Plus, X, Bell, Sparkles, Power, Loader2
} from 'lucide-react'
import { clientsApi } from '../api/clients'
import { settingsApi } from '../api/settings'
import { mealsApi, metricsApi, chatApi, clientMemoryApi, remindersApi } from '../api/data'
import { nutritionProgramsApi } from '../api/nutritionPrograms'
import type { Client, Meal, HealthMetric, ChatMessage, BotPersona, NutritionProgramListItem, Reminder, ContextBlock } from '../types'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/ru'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('ru')

const timezoneOptions = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
]

type Tab = 'meals' | 'metrics' | 'nutrition' | 'chat' | 'reminders' | 'settings'

const tabs: { id: Tab; label: string; icon: typeof Utensils }[] = [
  { id: 'meals', label: 'Питание', icon: Utensils },
  { id: 'metrics', label: 'Метрики', icon: Activity },
  { id: 'nutrition', label: 'Программа', icon: Calendar },
  { id: 'chat', label: 'Чат', icon: MessageCircle },
  { id: 'reminders', label: 'Уведомления', icon: Bell },
  { id: 'settings', label: 'Настройки', icon: Settings },
]

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'Активен', bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  pending: { label: 'Ожидает', bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' },
  paused: { label: 'На паузе', bg: 'bg-secondary', text: 'text-secondary-foreground', dot: 'bg-muted-foreground' },
  archived: { label: 'Архив', bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-400' },
}

// Loading skeleton component
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const clientId = Number(id)

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('meals')
  const [saving, setSaving] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    city: '',
    timezone: '',
    status: 'pending' as string,
  })

  const [physiology, setPhysiology] = useState({
    gender: '' as string,
    age: '',
    height: '',
    weight: '',
    birth_date: '',
    activity_level: '' as string,
  })
  const [savingPhysiology, setSavingPhysiology] = useState(false)
  const [physiologyMsg, setPhysiologyMsg] = useState('')

  const [norms, setNorms] = useState({
    daily_calories: '',
    daily_proteins: '',
    daily_fats: '',
    daily_carbs: '',
    daily_water: '',
  })

  const [personas, setPersonas] = useState<BotPersona[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [metrics, setMetrics] = useState<HealthMetric[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nutritionPrograms, setNutritionPrograms] = useState<NutritionProgramListItem[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  useEffect(() => {
    settingsApi.getPersonas().then(({ data }) => setPersonas(data))
  }, [])

  useEffect(() => {
    clientsApi.get(clientId)
      .then(({ data }) => {
        setClient(data)
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          city: data.city || '',
          timezone: data.timezone || '',
          status: data.status,
        })
        setPhysiology({
          gender: data.gender || '',
          age: data.age?.toString() || '',
          height: data.height?.toString() || '',
          weight: data.weight?.toString() || '',
          birth_date: data.birth_date || '',
          activity_level: data.activity_level || '',
        })
        setNorms({
          daily_calories: data.daily_calories?.toString() || '',
          daily_proteins: data.daily_proteins?.toString() || '',
          daily_fats: data.daily_fats?.toString() || '',
          daily_carbs: data.daily_carbs?.toString() || '',
          daily_water: data.daily_water?.toString() || '',
        })
      })
      .finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => {
    loadTabData()
  }, [tab, clientId])

  const loadTabData = () => {
    setTabLoading(true)
    if (tab === 'meals') {
      mealsApi.list({ client_id: clientId })
        .then(({ data }) => setMeals(data))
        .finally(() => setTabLoading(false))
    } else if (tab === 'metrics') {
      Promise.all([
        metricsApi.list({ client_id: clientId }),
        mealsApi.list({ client_id: clientId }),
      ])
        .then(([metricsRes, mealsRes]) => {
          setMetrics(metricsRes.data)
          setMeals(mealsRes.data)
        })
        .finally(() => setTabLoading(false))
    } else if (tab === 'nutrition') {
      nutritionProgramsApi.list({ client: clientId })
        .then(({ data }) => setNutritionPrograms(data.results || []))
        .finally(() => setTabLoading(false))
    } else if (tab === 'chat') {
      chatApi.messages(clientId)
        .then(({ data }) => setMessages(data.results))
        .finally(() => setTabLoading(false))
    } else if (tab === 'reminders') {
      remindersApi.list(clientId)
        .then(({ data }) => setReminders(data))
        .finally(() => setTabLoading(false))
    } else {
      setTabLoading(false)
    }
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    setProfileMsg('')
    try {
      const { data } = await clientsApi.update(clientId, profile as Partial<Client>)
      setClient(data)
      setProfileMsg('Сохранено')
      setTimeout(() => setProfileMsg(''), 2000)
    } catch {
      setProfileMsg('Ошибка сохранения')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePhysiology = async () => {
    setSavingPhysiology(true)
    setPhysiologyMsg('')
    try {
      const { data } = await clientsApi.update(clientId, {
        gender: physiology.gender || null,
        age: physiology.age ? Number(physiology.age) : null,
        height: physiology.height ? Number(physiology.height) : null,
        weight: physiology.weight ? Number(physiology.weight) : null,
        birth_date: physiology.birth_date || null,
        activity_level: physiology.activity_level || null,
      } as Partial<Client>)
      setClient(data)
      setPhysiologyMsg('Сохранено')
      setTimeout(() => setPhysiologyMsg(''), 2000)
    } catch {
      setPhysiologyMsg('Ошибка сохранения')
    } finally {
      setSavingPhysiology(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Удалить клиента? Все данные будут удалены безвозвратно.')) return
    try {
      await clientsApi.delete(clientId)
      navigate('/clients')
    } catch {
      alert('Ошибка удаления')
    }
  }

  const handlePersonaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const personaId = val ? Number(val) : null
    const { data } = await clientsApi.setPersona(clientId, personaId)
    setClient(data)
  }

  const saveNorms = async () => {
    setSaving(true)
    try {
      const { data } = await clientsApi.update(clientId, {
        daily_calories: norms.daily_calories ? Number(norms.daily_calories) : null,
        daily_proteins: norms.daily_proteins ? Number(norms.daily_proteins) : null,
        daily_fats: norms.daily_fats ? Number(norms.daily_fats) : null,
        daily_carbs: norms.daily_carbs ? Number(norms.daily_carbs) : null,
        daily_water: norms.daily_water ? Number(norms.daily_water) : null,
      })
      setClient(data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">Клиент не найден</h2>
        <Link to="/clients" className="text-primary hover:text-primary/80 text-sm">
          Вернуться к списку
        </Link>
      </div>
    )
  }

  const initials = `${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}`.toUpperCase() || '?'
  const status = statusConfig[client.status] || statusConfig.pending

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/clients"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Клиенты
      </Link>

      {/* Profile card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Gradient banner */}
        <div className="h-28 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600" />

        {/* Profile content */}
        <div className="px-4 sm:px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5 -mt-10 sm:-mt-14">
            {/* Avatar */}
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 border-4 border-white shadow-lg flex items-center justify-center shrink-0">
              <span className="text-2xl sm:text-3xl font-bold text-white">{initials}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 sm:pb-2">
              <div className="flex items-start sm:items-center justify-between sm:justify-start gap-2 sm:gap-3 flex-wrap">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                    {client.first_name} {client.last_name}
                  </h1>
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${status.bg} ${status.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>
                {/* Delete button - mobile */}
                <button
                  onClick={handleDelete}
                  className="sm:hidden flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                {client.telegram_username && (
                  <span className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Send size={14} />
                    @{client.telegram_username}
                  </span>
                )}
                {client.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} />
                    {client.city}
                  </span>
                )}
                {client.timezone && (
                  <span className="hidden sm:flex items-center gap-1.5">
                    <Clock size={14} />
                    {timezoneOptions.find((tz) => tz.value === client.timezone)?.label || client.timezone}
                  </span>
                )}
              </div>
            </div>

            {/* Delete button - desktop */}
            <button
              onClick={handleDelete}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <Trash2 size={16} />
              <span>Удалить</span>
            </button>
          </div>

          {/* Quick stats */}
          {client.daily_calories && (
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <QuickStat
                  icon={Flame}
                  label="Калории"
                  value={client.daily_calories}
                  unit="ккал"
                  color="orange"
                />
                <QuickStat
                  icon={Beef}
                  label="Белки"
                  value={client.daily_proteins}
                  unit="г"
                  color="red"
                />
                <QuickStat
                  icon={Droplets}
                  label="Жиры"
                  value={client.daily_fats}
                  unit="г"
                  color="yellow"
                />
                <QuickStat
                  icon={Wheat}
                  label="Углеводы"
                  value={client.daily_carbs}
                  unit="г"
                  color="green"
                />
                <QuickStat
                  icon={Droplets}
                  label="Вода"
                  value={client.daily_water}
                  unit="л"
                  color="blue"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex border-b border-border">
          {tabs.map((t) => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all relative ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon size={18} />
                <span className="hidden sm:inline">{t.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {tabLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : tab === 'meals' ? (
            <MealsTab meals={meals} />
          ) : tab === 'metrics' ? (
            <MetricsTab metrics={metrics} meals={meals} clientId={clientId} clientTimezone={client?.timezone} />
          ) : tab === 'nutrition' ? (
            <NutritionTab programs={nutritionPrograms} clientId={clientId} onProgramsUpdate={loadTabData} />
          ) : tab === 'chat' ? (
            <ChatTab
              messages={messages}
              client={client}
              onClientUpdate={setClient}
              onMessagesUpdate={setMessages}
            />
          ) : tab === 'reminders' ? (
            <RemindersTab
              clientId={clientId}
              reminders={reminders}
              onUpdate={() => remindersApi.list(clientId).then(({ data }) => setReminders(data))}
            />
          ) : (
            <SettingsTab
              client={client}
              onClientUpdate={setClient}
              profile={profile}
              setProfile={setProfile}
              saveProfile={saveProfile}
              savingProfile={savingProfile}
              profileMsg={profileMsg}
              physiology={physiology}
              setPhysiology={setPhysiology}
              savePhysiology={savePhysiology}
              savingPhysiology={savingPhysiology}
              physiologyMsg={physiologyMsg}
              personas={personas}
              handlePersonaChange={handlePersonaChange}
              norms={norms}
              setNorms={setNorms}
              saveNorms={saveNorms}
              saving={saving}
              timezoneOptions={timezoneOptions}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Quick stat component for profile card
function QuickStat({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: typeof Flame
  label: string
  value: number | null
  unit: string
  color: 'orange' | 'red' | 'yellow' | 'green' | 'blue'
}) {
  if (!value) return null

  const colors = {
    orange: 'bg-orange-500/20 text-orange-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-amber-500/20 text-amber-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/20 text-blue-400',
  }

  return (
    <div className={`rounded-xl p-3 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="opacity-70" />
        <span className="text-xs opacity-70">{label}</span>
      </div>
      <div className="text-lg font-bold">
        {value} <span className="text-sm font-normal opacity-70">{unit}</span>
      </div>
    </div>
  )
}

// Meals tab with accordion by date
function MealsTab({ meals }: { meals: Meal[] }) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const mealsByDate = useMemo(() => {
    const grouped: Record<string, Meal[]> = {}
    meals.forEach((meal) => {
      const date = dayjs(meal.meal_time).format('YYYY-MM-DD')
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(meal)
    })
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))
  }, [meals])

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const getDayTotals = (dayMeals: Meal[]) => {
    return dayMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories || 0),
        proteins: acc.proteins + (m.proteins || 0),
        fats: acc.fats + (m.fats || 0),
        carbs: acc.carbs + (m.carbohydrates || 0),
      }),
      { calories: 0, proteins: 0, fats: 0, carbs: 0 }
    )
  }

  if (!meals.length) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Utensils className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">Нет записей о питании</h3>
        <p className="text-sm text-muted-foreground">Данные появятся когда клиент начнёт отправлять фото еды</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {mealsByDate.map(([date, dayMeals]) => {
          const isExpanded = expandedDates.has(date)
          const totals = getDayTotals(dayMeals)
          const isToday = dayjs(date).isSame(dayjs(), 'day')
          const isYesterday = dayjs(date).isSame(dayjs().subtract(1, 'day'), 'day')

          let dateLabel = dayjs(date).format('D MMMM, dddd')
          if (isToday) dateLabel = 'Сегодня'
          else if (isYesterday) dateLabel = 'Вчера'

          return (
            <div
              key={date}
              className={`rounded-xl border transition-all ${
                isExpanded ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:border-border/80'
              }`}
            >
              {/* Date header */}
              <button
                onClick={() => toggleDate(date)}
                className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isExpanded ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  <div className="text-left">
                    <span className="font-medium text-foreground capitalize">{dateLabel}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {dayMeals.length} {dayMeals.length === 1 ? 'приём' : dayMeals.length < 5 ? 'приёма' : 'приёмов'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 text-sm">
                  <span className="font-semibold text-orange-400">{Math.round(totals.calories)}</span>
                  <span className="text-muted-foreground hidden sm:inline">|</span>
                  <div className="hidden sm:flex items-center gap-3 text-muted-foreground">
                    <span>Б: {Math.round(totals.proteins)}</span>
                    <span>Ж: {Math.round(totals.fats)}</span>
                    <span>У: {Math.round(totals.carbs)}</span>
                  </div>
                </div>
              </button>

              {/* Meals list */}
              {isExpanded && (
                <div className="border-t border-border/50 divide-y divide-border/30">
                  {dayMeals.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMeal(m)}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-muted cursor-pointer transition-colors"
                    >
                      {m.image ? (
                        <img
                          src={m.image}
                          alt={m.dish_name}
                          className="w-14 h-14 object-cover rounded-xl flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                          <Utensils className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">{m.dish_name}</span>
                          {m.dish_type && (
                            <span className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full hidden sm:inline">
                              {m.dish_type}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {dayjs(m.meal_time).format('HH:mm')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4 text-sm">
                        <span className="font-medium text-orange-400 min-w-[3rem] text-right">
                          {m.calories ? Math.round(m.calories) : '—'}
                        </span>
                        <div className="hidden sm:flex items-center gap-3 text-muted-foreground text-right">
                          <span className="w-8">{m.proteins ? Math.round(m.proteins) : '—'}</span>
                          <span className="w-8">{m.fats ? Math.round(m.fats) : '—'}</span>
                          <span className="w-8">{m.carbohydrates ? Math.round(m.carbohydrates) : '—'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Meal detail modal */}
      {selectedMeal && (
        <MealModal meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}
    </>
  )
}

// Meal detail modal component
function MealModal({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with image */}
        <div className="relative bg-background">
          {meal.image ? (
            <img
              src={meal.image}
              alt={meal.dish_name}
              className="w-full max-h-[50vh] object-contain"
            />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-muted to-background flex items-center justify-center">
              <Utensils className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors text-xl"
          >
            ×
          </button>
          {meal.ai_confidence && (
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full">
              AI уверенность: {meal.ai_confidence}%
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-20rem)]">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-foreground">{meal.dish_name}</h2>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Calendar size={14} />
              {dayjs(meal.meal_time).format('D MMMM YYYY, HH:mm')}
              {meal.dish_type && (
                <span className="ml-2 px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs">{meal.dish_type}</span>
              )}
            </div>
          </div>

          {/* KBJU Cards */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { label: 'ккал', value: meal.calories, color: 'bg-orange-500/20 text-orange-400' },
              { label: 'белки', value: meal.proteins, color: 'bg-red-500/20 text-red-400' },
              { label: 'жиры', value: meal.fats, color: 'bg-amber-500/20 text-amber-400' },
              { label: 'углеводы', value: meal.carbohydrates, color: 'bg-emerald-500/20 text-emerald-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl p-3 text-center ${color}`}>
                <div className="text-2xl font-bold">{value ? Math.round(value) : '—'}</div>
                <div className="text-xs opacity-70 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Ingredients */}
          {meal.ingredients && meal.ingredients.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-medium text-secondary-foreground mb-3">Ингредиенты</h3>
              <div className="flex flex-wrap gap-2">
                {meal.ingredients.map((ing, i) => (
                  <span key={i} className="px-3 py-1.5 bg-secondary text-secondary-foreground text-sm rounded-full">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional info */}
          {(meal.plate_type || meal.layout || meal.decorations) && (
            <div className="border-t border-border/50 pt-5">
              <h3 className="text-sm font-medium text-secondary-foreground mb-3">Дополнительно</h3>
              <div className="space-y-2 text-sm text-foreground">
                {meal.plate_type && (
                  <div className="flex"><span className="text-muted-foreground w-24">Подача:</span><span>{meal.plate_type}</span></div>
                )}
                {meal.layout && (
                  <div className="flex"><span className="text-muted-foreground w-24">Выкладка:</span><span>{meal.layout}</span></div>
                )}
                {meal.decorations && (
                  <div className="flex"><span className="text-muted-foreground w-24">Декор:</span><span>{meal.decorations}</span></div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Metric type config
const metricConfig: Record<string, { label: string; icon: string; color: string; format: (v: number) => string }> = {
  steps: { label: 'Шаги', icon: '👟', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', format: (v) => v.toLocaleString() },
  active_calories: { label: 'Активные калории', icon: '🔥', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', format: (v) => `${Math.round(v)} ккал` },
  heart_rate: { label: 'Пульс', icon: '❤️', color: 'bg-red-500/20 text-red-400 border-red-500/30', format: (v) => `${Math.round(v)} уд/мин` },
  sleep: { label: 'Сон', icon: '😴', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', format: (v) => `${Math.floor(v / 60)}ч ${Math.round(v % 60)}м` },
  sleep_minutes: { label: 'Сон', icon: '😴', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', format: (v) => `${Math.floor(v / 60)}ч ${Math.round(v % 60)}м` },
  weight: { label: 'Вес', icon: '⚖️', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', format: (v) => `${v} кг` },
  distance: { label: 'Дистанция', icon: '📍', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)} км` : `${Math.round(v)} м` },
  water: { label: 'Вода', icon: '💧', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', format: (v) => `${v} мл` },
}

const defaultMetricConfig = { label: '', icon: '📊', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', format: (v: number) => String(v) }

// Metrics tab
function MetricsTab({ metrics, meals, clientId, clientTimezone }: { metrics: HealthMetric[]; meals: Meal[]; clientId: number; clientTimezone?: string }) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [integrations, setIntegrations] = useState<Array<{
    type: string
    name: string
    connected: boolean
    last_sync_at?: string
    has_error?: boolean
    error_message?: string
    last_sync_status?: string
    metrics_synced?: Record<string, number>
  }>>([])
  const [syncing, setSyncing] = useState<string | null>(null)
  const [integrationsLoading, setIntegrationsLoading] = useState(true)

  // Load integrations status
  useEffect(() => {
    import('../api/data').then(({ integrationsApi }) => {
      integrationsApi.overview()
        .then(({ data }) => {
          const clientData = data.clients.find(c => c.client_id === clientId)
          if (clientData) {
            setIntegrations(clientData.integrations)
          }
        })
        .finally(() => setIntegrationsLoading(false))
    })
  }, [clientId])

  const handleSync = async (integrationType: string) => {
    setSyncing(integrationType)
    try {
      const { integrationsApi } = await import('../api/data')
      await integrationsApi.triggerSync(clientId, integrationType)
      // Refresh integrations status after a delay
      setTimeout(() => {
        integrationsApi.overview().then(({ data }) => {
          const clientData = data.clients.find(c => c.client_id === clientId)
          if (clientData) {
            setIntegrations(clientData.integrations)
          }
        })
      }, 2000)
    } finally {
      setSyncing(null)
    }
  }

  const integrationIcons: Record<string, string> = {
    google_fit: '🏃',
    huawei_health: '⌚',
  }

  const hasConnectedIntegrations = integrations.some(i => i.connected)

  // Group metrics by type and calculate today's totals
  // Use client timezone for "today" calculation to match Google Fit
  const tz = clientTimezone || 'Europe/Moscow'
  const today = dayjs().tz(tz).format('YYYY-MM-DD')
  const metricsByType: Record<string, { today: number; total: number; count: number; unit: string; latest: HealthMetric }> = {}

  metrics.forEach((m) => {
    const type = m.metric_type
    if (!metricsByType[type]) {
      metricsByType[type] = { today: 0, total: 0, count: 0, unit: m.unit, latest: m }
    }
    metricsByType[type].total += m.value
    metricsByType[type].count += 1
    // Convert metric time to client timezone for comparison
    if (dayjs(m.recorded_at).tz(tz).format('YYYY-MM-DD') === today) {
      metricsByType[type].today += m.value
    }
    if (dayjs(m.recorded_at).isAfter(dayjs(metricsByType[type].latest.recorded_at))) {
      metricsByType[type].latest = m
    }
  })

  const types = Object.keys(metricsByType)

  // Calculate calorie balance: consumed (from meals) - burned (active_calories)
  const todayConsumed = meals
    .filter((m) => dayjs(m.meal_time).tz(tz).format('YYYY-MM-DD') === today)
    .reduce((sum, m) => sum + (m.calories || 0), 0)
  const todayBurned = metricsByType['active_calories']?.today || 0
  const calorieBalance = Math.round(todayConsumed - todayBurned)

  // Get metrics for selected type
  const selectedMetrics = selectedType
    ? metrics.filter((m) => m.metric_type === selectedType).slice(0, 20)
    : []

  return (
    <div className="space-y-6">
      {/* Integrations section */}
      <div className="bg-muted rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-foreground">Источники данных</h3>
        </div>

        {integrationsLoading ? (
          <div className="text-sm text-muted-foreground">Загрузка...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {integrations.map((integration) => (
              <div
                key={integration.type}
                className={`p-3 rounded-lg border ${
                  integration.connected
                    ? integration.has_error
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-green-500/10 border-green-500/30'
                    : 'bg-card border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{integrationIcons[integration.type] || '📊'}</span>
                    <div>
                      <div className="text-sm font-medium text-foreground">{integration.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {integration.connected ? (
                          integration.has_error ? (
                            <span className="text-red-400">Ошибка синхронизации</span>
                          ) : integration.last_sync_at ? (
                            `Синхр.: ${dayjs(integration.last_sync_at).format('D MMM, HH:mm')}`
                          ) : (
                            'Подключено'
                          )
                        ) : (
                          'Не подключено'
                        )}
                      </div>
                    </div>
                  </div>

                  {integration.connected && (
                    <button
                      onClick={() => handleSync(integration.type)}
                      disabled={syncing === integration.type}
                      className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {syncing === integration.type ? 'Синхр...' : 'Обновить'}
                    </button>
                  )}
                </div>

                {integration.connected && integration.metrics_synced && Object.keys(integration.metrics_synced).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(integration.metrics_synced).map(([metric, count]) => (
                        <span key={metric} className="text-xs bg-secondary px-2 py-0.5 rounded text-secondary-foreground">
                          {metric}: +{count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {integration.has_error && integration.error_message && (
                  <div className="mt-2 text-xs text-red-400 truncate" title={integration.error_message}>
                    {integration.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!integrationsLoading && !hasConnectedIntegrations && (
          <p className="text-sm text-muted-foreground mt-3">
            Клиент может подключить Google Fit или Huawei Health в мини-приложении
          </p>
        )}
      </div>

      {/* Metric cards */}
      {(types.length > 0 || todayConsumed > 0 || todayBurned > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Calorie balance card */}
          {(todayConsumed > 0 || todayBurned > 0) && (
            <div className={`p-4 rounded-xl border ${
              calorieBalance > 0
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                : calorieBalance < 0
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{calorieBalance > 0 ? '📈' : calorieBalance < 0 ? '📉' : '⚖️'}</span>
                <span className="text-sm font-medium opacity-90">Баланс</span>
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {calorieBalance > 0 ? '+' : ''}{calorieBalance}
                </div>
                <div className="text-xs opacity-70 space-y-0.5">
                  <div>потр. {Math.round(todayConsumed)}</div>
                  <div>сожж. {Math.round(todayBurned)}</div>
                </div>
              </div>
            </div>
          )}
          {types.map((type) => {
            const data = metricsByType[type]
            const config = metricConfig[type] || { ...defaultMetricConfig, label: type }
            const isSelected = selectedType === type

            return (
              <button
              key={type}
              onClick={() => setSelectedType(isSelected ? null : type)}
              className={`p-4 rounded-xl border text-left transition-all ${config.color} ${
                isSelected ? 'ring-2 ring-primary scale-[1.02]' : 'hover:scale-[1.01]'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{config.icon}</span>
                <span className="text-sm font-medium opacity-90">{config.label || type}</span>
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {config.format(data.today)}
                </div>
                <div className="text-xs opacity-70">
                  сегодня
                </div>
              </div>
            </button>
          )
        })}
      </div>
      )}

      {/* Detail view for selected metric */}
      {selectedType && selectedMetrics.length > 0 && (
        <div className="bg-muted rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground">
              {(metricConfig[selectedType] || defaultMetricConfig).label || selectedType} — последние записи
            </h3>
            <button
              onClick={() => setSelectedType(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Закрыть
            </button>
          </div>

          <div className="space-y-2">
            {selectedMetrics.map((m) => {
              const config = metricConfig[m.metric_type] || defaultMetricConfig
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2 px-3 bg-card rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {dayjs(m.recorded_at).format('D MMM, HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {config.format(m.value)}
                    </span>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                      {m.source}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Nutrition programs tab
function NutritionTab({
  programs,
  clientId,
  onProgramsUpdate,
}: {
  programs: NutritionProgramListItem[]
  clientId: number
  onProgramsUpdate: () => void
}) {
  const navigate = useNavigate()
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const statusLabels: Record<string, { label: string; class: string }> = {
    draft: { label: 'Черновик', class: 'bg-secondary text-secondary-foreground' },
    active: { label: 'Активна', class: 'bg-green-500/20 text-green-400' },
    completed: { label: 'Завершена', class: 'bg-blue-500/20 text-blue-400' },
    cancelled: { label: 'Отменена', class: 'bg-red-500/20 text-red-400' },
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }

  const handleActivate = async (e: React.MouseEvent, programId: number) => {
    e.stopPropagation()
    setActionLoading(programId)
    try {
      await nutritionProgramsApi.activate(programId)
      onProgramsUpdate()
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (e: React.MouseEvent, programId: number) => {
    e.stopPropagation()
    if (!confirm('Отменить программу питания?')) return
    setActionLoading(programId)
    try {
      await nutritionProgramsApi.cancel(programId)
      onProgramsUpdate()
    } finally {
      setActionLoading(null)
    }
  }

  if (!programs.length) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">Нет программ питания</h3>
        <p className="text-sm text-muted-foreground mb-4">Создайте программу для этого клиента</p>
        <button
          onClick={() => navigate(`/nutrition-programs/new?client=${clientId}`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          Создать программу
        </button>
      </div>
    )
  }

  const activeProgram = programs.find((p) => p.status === 'active')

  return (
    <div className="space-y-4">
      {/* Active program card */}
      {activeProgram && (
        <div className="p-4 rounded-xl border-2 border-green-500/30 bg-green-500/5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-400">Активная программа</span>
          </div>

          <div
            onClick={() => navigate(`/nutrition-programs/${activeProgram.id}`)}
            className="cursor-pointer"
          >
            <div className="font-medium text-foreground mb-1">{activeProgram.name}</div>
            <div className="text-sm text-muted-foreground mb-3">
              {formatDate(activeProgram.start_date)} - {formatDate(activeProgram.end_date)}
            </div>

            <div className="flex items-center gap-4 text-sm mb-3">
              <span className="text-muted-foreground">
                День <span className="text-foreground font-medium">{activeProgram.current_day || 1}</span> из {activeProgram.duration_days}
              </span>
              {activeProgram.compliance_rate !== null && (
                <span className="text-muted-foreground">
                  Соблюдение: <span className="text-foreground font-medium">{activeProgram.compliance_rate}%</span>
                </span>
              )}
            </div>

            {activeProgram.compliance_rate !== null && (
              <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full transition-all ${
                    activeProgram.compliance_rate >= 80
                      ? 'bg-green-500'
                      : activeProgram.compliance_rate >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${activeProgram.compliance_rate}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <button
              onClick={() => navigate(`/nutrition-programs/${activeProgram.id}/stats`)}
              className="text-xs text-primary hover:text-primary/80"
            >
              Статистика
            </button>
            <span className="text-border">|</span>
            <button
              onClick={(e) => handleCancel(e, activeProgram.id)}
              disabled={actionLoading === activeProgram.id}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              {actionLoading === activeProgram.id ? 'Отмена...' : 'Отменить'}
            </button>
          </div>
        </div>
      )}

      {/* Other programs */}
      {programs.filter((p) => p.status !== 'active').length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {activeProgram ? 'Другие программы' : 'Программы'}
          </h4>
          <div className="space-y-2">
            {programs
              .filter((p) => p.status !== 'active')
              .map((program) => (
                <div
                  key={program.id}
                  onClick={() => navigate(`/nutrition-programs/${program.id}`)}
                  className="p-3 rounded-lg border border-border bg-card hover:bg-muted cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground text-sm">{program.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(program.start_date)} - {formatDate(program.end_date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {program.status === 'draft' && (
                        <button
                          onClick={(e) => handleActivate(e, program.id)}
                          disabled={actionLoading === program.id}
                          className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50"
                        >
                          {actionLoading === program.id ? '...' : 'Активировать'}
                        </button>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabels[program.status]?.class}`}
                      >
                        {statusLabels[program.status]?.label}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <button
        onClick={() => navigate(`/nutrition-programs/new?client=${clientId}`)}
        className="w-full p-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      >
        + Создать новую программу
      </button>
    </div>
  )
}

// Chat tab
function ChatTab({
  messages,
  client,
  onClientUpdate,
  onMessagesUpdate,
}: {
  messages: ChatMessage[]
  client: Client
  onClientUpdate: (c: Client) => void
  onMessagesUpdate: (msgs: ChatMessage[]) => void
}) {
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [toggling, setToggling] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const pollMessages = useCallback(() => {
    chatApi.messages(client.id).then(({ data }) => onMessagesUpdate(data.results))
  }, [client.id, onMessagesUpdate])

  useEffect(() => {
    const interval = setInterval(pollMessages, 5000)
    return () => clearInterval(interval)
  }, [pollMessages])

  const toggleManualMode = async () => {
    setToggling(true)
    try {
      const { data } = await clientsApi.update(client.id, { manual_mode: !client.manual_mode } as Partial<Client>)
      onClientUpdate(data)
    } finally {
      setToggling(false)
    }
  }

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text) return
    setSending(true)
    try {
      const { data } = await chatApi.send(client.id, text)
      onMessagesUpdate([...messages, data])
      setInputText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {/* Manual mode toggle */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <button
            onClick={toggling ? undefined : toggleManualMode}
            disabled={toggling}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              client.manual_mode ? 'bg-primary' : 'bg-muted'
            } ${toggling ? 'opacity-50' : ''}`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                client.manual_mode ? 'translate-x-5' : ''
              }`}
            />
          </button>
          <span className="text-sm font-medium text-secondary-foreground">Ручной режим</span>
        </div>
        {client.manual_mode && (
          <span className="text-xs text-primary bg-primary/20 px-2 py-1 rounded-full">
            Бот отключён, вы отвечаете вручную
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
        {!messages.length && (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Нет сообщений</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted text-foreground rounded-bl-md'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {dayjs(msg.created_at).format('HH:mm')}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {client.manual_mode && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Написать сообщение..."
            className="flex-1 px-4 py-2.5 text-sm bg-background text-foreground border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputText.trim()}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// Reminders tab
const REMINDER_TYPE_OPTIONS = [
  { value: 'morning', label: 'Утреннее приветствие', description: 'AI генерирует уникальное сообщение каждый день' },
  { value: 'meal_program', label: 'Приём пищи (программа)', description: 'Напоминание за N минут до приёма по программе' },
  { value: 'event', label: 'По событию', description: 'Отправляется после события (тренировка и т.д.)' },
  { value: 'custom', label: 'Произвольное', description: 'Свой текст по расписанию' },
]

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Однократно' },
  { value: 'daily', label: 'Ежедневно' },
  { value: 'weekly', label: 'Еженедельно' },
]

const DEFAULT_CONTEXT_BLOCKS = [
  { id: 'greeting', label: 'Приветствие' },
  { id: 'weather', label: 'Погода' },
  { id: 'meal_plan', label: 'План питания' },
  { id: 'workout_plan', label: 'Тренировки' },
  { id: 'sport_tip', label: 'Совет по спорту' },
  { id: 'nutrition_tip', label: 'Совет по питанию' },
  { id: 'motivation', label: 'Мотивация' },
  { id: 'metrics_summary', label: 'Показатели' },
]

function RemindersTab({ clientId, reminders, onUpdate }: {
  clientId: number
  reminders: Reminder[]
  onUpdate: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  const handleCreate = () => {
    setEditingReminder(null)
    setShowModal(true)
  }

  const handleEdit = (r: Reminder) => {
    setEditingReminder(r)
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    await remindersApi.delete(id)
    onUpdate()
  }

  const handleToggle = async (r: Reminder) => {
    await remindersApi.update(r.id, {
      ...r,
      client_id: clientId,
      is_active: !r.is_active,
    })
    onUpdate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Уведомления</h3>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
        >
          <Plus size={16} />
          Добавить
        </button>
      </div>

      {reminders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p>Нет настроенных уведомлений</p>
          <p className="text-xs mt-1">Добавьте уведомления для автоматической отправки клиенту</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => (
            <div key={r.id} className={`bg-muted rounded-xl p-4 ${!r.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {r.reminder_type_display}
                    </span>
                    {r.time && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={12} /> {r.time.slice(0, 5)}
                      </span>
                    )}
                    {r.frequency_display && (
                      <span className="text-xs text-muted-foreground">{r.frequency_display}</span>
                    )}
                  </div>
                  <p className="font-medium text-foreground text-sm">{r.title}</p>
                  {r.message && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.message}</p>
                  )}
                  {r.reminder_type === 'morning' && r.context_blocks.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.context_blocks.map((b) => {
                        const block = DEFAULT_CONTEXT_BLOCKS.find((cb) => cb.id === b)
                        return (
                          <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-card text-muted-foreground">
                            {block?.label || b}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {r.reminder_type === 'meal_program' && (
                    <p className="text-xs text-muted-foreground mt-1">За {r.offset_minutes} мин до приёма</p>
                  )}
                  {r.reminder_type === 'event' && (
                    <p className="text-xs text-muted-foreground mt-1">Через {r.trigger_delay_minutes} мин после тренировки</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(r)}
                    className={`p-1.5 rounded-lg transition-colors ${r.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-muted'}`}
                    title={r.is_active ? 'Выключить' : 'Включить'}
                  >
                    <Power size={16} />
                  </button>
                  <button
                    onClick={() => handleEdit(r)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Редактировать"
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ReminderModal
          clientId={clientId}
          reminder={editingReminder}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); onUpdate() }}
        />
      )}
    </div>
  )
}

// Reminder create/edit modal
function ReminderModal({ clientId, reminder, onClose, onSave }: {
  clientId: number
  reminder: Reminder | null
  onClose: () => void
  onSave: () => void
}) {
  const [type, setType] = useState(reminder?.reminder_type || 'custom')
  const [title, setTitle] = useState(reminder?.title || '')
  const [message, setMessage] = useState(reminder?.message || '')
  const [time, setTime] = useState(reminder?.time?.slice(0, 5) || '08:00')
  const [frequency, setFrequency] = useState(reminder?.frequency || 'daily')
  const [contextBlocks, setContextBlocks] = useState<string[]>(reminder?.context_blocks || ['greeting', 'meal_plan', 'workout_plan'])
  const [offsetMinutes, setOffsetMinutes] = useState(String(reminder?.offset_minutes || 30))
  const [triggerDelay, setTriggerDelay] = useState(String(reminder?.trigger_delay_minutes || 30))
  const [generationPrompt, setGenerationPrompt] = useState(reminder?.generation_prompt || '')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const data: Record<string, unknown> = {
        client_id: clientId,
        title: title || REMINDER_TYPE_OPTIONS.find((o) => o.value === type)?.label || 'Уведомление',
        message,
        reminder_type: type,
        frequency: type === 'morning' ? 'daily' : type === 'event' ? 'custom' : frequency,
        time: type === 'event' || type === 'meal_program' ? null : time,
        is_active: true,
        is_smart: type === 'morning',
        context_blocks: type === 'morning' ? contextBlocks : [],
        offset_minutes: type === 'meal_program' ? parseInt(offsetMinutes) || 30 : 30,
        trigger_event: type === 'event' ? 'workout_completed' : '',
        trigger_delay_minutes: type === 'event' ? parseInt(triggerDelay) || 30 : 30,
        generation_prompt: generationPrompt,
      }
      if (reminder) {
        await remindersApi.update(reminder.id, data)
      } else {
        await remindersApi.create(data)
      }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const { data } = await remindersApi.generateText({
        client_id: clientId,
        reminder_type: type,
        context_blocks: type === 'morning' ? contextBlocks : undefined,
        base_text: message || undefined,
        generation_prompt: generationPrompt || undefined,
      })
      setMessage(data.text)
    } finally {
      setGenerating(false)
    }
  }

  const toggleBlock = (id: string) => {
    setContextBlocks((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {reminder ? 'Редактировать' : 'Новое уведомление'}
          </h3>

          {/* Тип */}
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Тип</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {REMINDER_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  type === opt.value
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-muted text-muted-foreground hover:border-primary/50'
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs opacity-70 mt-0.5">{opt.description}</div>
              </button>
            ))}
          </div>

          {/* Название */}
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Название</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={REMINDER_TYPE_OPTIONS.find((o) => o.value === type)?.label}
            className="w-full px-3 py-2 text-sm bg-muted text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 placeholder:text-muted-foreground"
          />

          {/* Время (не для event и meal_program) */}
          {type !== 'event' && type !== 'meal_program' && (
            <>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Время</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
              />
            </>
          )}

          {/* Частота (только для custom) */}
          {type === 'custom' && (
            <>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Частота</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
              >
                {FREQUENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </>
          )}

          {/* Контекстные блоки (для morning) */}
          {type === 'morning' && (
            <>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Контекстные блоки</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {DEFAULT_CONTEXT_BLOCKS.map((block) => (
                  <button
                    key={block.id}
                    onClick={() => toggleBlock(block.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      contextBlocks.includes(block.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground border border-border hover:border-primary/50'
                    }`}
                  >
                    {block.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Offset (для meal_program) */}
          {type === 'meal_program' && (
            <>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">За сколько минут до приёма</label>
              <input
                type="number"
                value={offsetMinutes}
                onChange={(e) => setOffsetMinutes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
              />
            </>
          )}

          {/* Задержка (для event) */}
          {type === 'event' && (
            <>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Через сколько минут после тренировки</label>
              <input
                type="number"
                value={triggerDelay}
                onChange={(e) => setTriggerDelay(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-muted text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
              />
            </>
          )}

          {/* Промпт для AI */}
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Промпт для AI (опционально)
          </label>
          <textarea
            value={generationPrompt}
            onChange={(e) => setGenerationPrompt(e.target.value)}
            placeholder="Дополнительные указания для AI при генерации текста..."
            rows={2}
            className="w-full px-3 py-2 text-sm bg-muted text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4 resize-none placeholder:text-muted-foreground"
          />

          {/* Текст сообщения */}
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Текст сообщения
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={type === 'morning' ? 'AI сгенерирует автоматически при отправке' : 'Текст уведомления...'}
            rows={4}
            className="w-full px-3 py-2 text-sm bg-muted text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-2 resize-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50 mb-4"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {message ? 'Доработать через AI' : 'Сгенерировать AI'}
          </button>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Settings tab
function SettingsTab({
  client,
  onClientUpdate,
  profile,
  setProfile,
  saveProfile,
  savingProfile,
  profileMsg,
  physiology,
  setPhysiology,
  savePhysiology,
  savingPhysiology,
  physiologyMsg,
  personas,
  handlePersonaChange,
  norms,
  setNorms,
  saveNorms,
  saving,
  timezoneOptions,
}: {
  client: Client
  onClientUpdate: (c: Client) => void
  profile: { first_name: string; last_name: string; city: string; timezone: string; status: string }
  setProfile: (p: typeof profile) => void
  saveProfile: () => Promise<void>
  savingProfile: boolean
  profileMsg: string
  physiology: { gender: string; age: string; height: string; weight: string; birth_date: string; activity_level: string }
  setPhysiology: (p: typeof physiology) => void
  savePhysiology: () => Promise<void>
  savingPhysiology: boolean
  physiologyMsg: string
  personas: BotPersona[]
  handlePersonaChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  norms: { daily_calories: string; daily_proteins: string; daily_fats: string; daily_carbs: string; daily_water: string }
  setNorms: (n: typeof norms) => void
  saveNorms: () => Promise<void>
  saving: boolean
  timezoneOptions: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <SettingsSection
        icon={User}
        title="Профиль"
        action={
          <SaveButton onClick={saveProfile} loading={savingProfile} message={profileMsg} />
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Имя" value={profile.first_name} onChange={(v) => setProfile({ ...profile, first_name: v })} />
          <FormField label="Фамилия" value={profile.last_name} onChange={(v) => setProfile({ ...profile, last_name: v })} />
          <FormField label="Город" value={profile.city} onChange={(v) => setProfile({ ...profile, city: v })} placeholder="Москва" />
          <FormSelect
            label="Статус"
            value={profile.status}
            onChange={(v) => setProfile({ ...profile, status: v })}
            options={[
              { value: 'pending', label: 'Ожидает' },
              { value: 'active', label: 'Активен' },
              { value: 'paused', label: 'На паузе' },
              { value: 'archived', label: 'Архив' },
            ]}
          />
        </div>
        <FormSelect
          label="Часовой пояс"
          value={profile.timezone}
          onChange={(v) => setProfile({ ...profile, timezone: v })}
          options={[{ value: '', label: 'Не указан' }, ...timezoneOptions.map((tz) => ({ value: tz.value, label: tz.label }))]}
          className="mt-4"
        />
      </SettingsSection>

      {/* Physiology Section */}
      <SettingsSection
        icon={Scale}
        title="Физиология"
        action={
          <SaveButton onClick={savePhysiology} loading={savingPhysiology} message={physiologyMsg} />
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <FormSelect
            label="Пол"
            value={physiology.gender}
            onChange={(v) => setPhysiology({ ...physiology, gender: v })}
            options={[
              { value: '', label: 'Не указан' },
              { value: 'male', label: 'Мужской' },
              { value: 'female', label: 'Женский' },
            ]}
          />
          <FormField
            label="Возраст"
            value={physiology.age}
            onChange={(v) => setPhysiology({ ...physiology, age: v })}
            type="number"
            placeholder="30"
            suffix="лет"
          />
          <FormField
            label="Рост"
            value={physiology.height}
            onChange={(v) => setPhysiology({ ...physiology, height: v })}
            type="number"
            placeholder="170"
            suffix="см"
            icon={Ruler}
          />
          <FormField
            label="Вес"
            value={physiology.weight}
            onChange={(v) => setPhysiology({ ...physiology, weight: v })}
            type="number"
            placeholder="70"
            suffix="кг"
            icon={Scale}
          />
          <FormField
            label="Дата рождения"
            value={physiology.birth_date}
            onChange={(v) => setPhysiology({ ...physiology, birth_date: v })}
            type="date"
            icon={Cake}
          />
          <FormSelect
            label="Активность"
            value={physiology.activity_level}
            onChange={(v) => setPhysiology({ ...physiology, activity_level: v })}
            options={[
              { value: '', label: 'Не указана' },
              { value: 'sedentary', label: 'Сидячий' },
              { value: 'light', label: 'Лёгкая' },
              { value: 'moderate', label: 'Умеренная' },
              { value: 'active', label: 'Высокая' },
              { value: 'very_active', label: 'Очень высокая' },
            ]}
          />
        </div>
      </SettingsSection>

      {/* Persona Section */}
      {personas.length > 0 && (
        <SettingsSection icon={MessageCircle} title="Персона бота">
          <select
            value={client.persona ?? ''}
            onChange={handlePersonaChange}
            className="w-full sm:w-auto px-4 py-2.5 text-sm bg-card text-foreground border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow"
          >
            <option value="">По умолчанию</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.role === 'controller' ? ' [контролёр]' : ''}{p.is_default ? ' (по умолч.)' : ''}
              </option>
            ))}
          </select>
        </SettingsSection>
      )}

      {/* Memory Section */}
      <MemorySection client={client} onClientUpdate={onClientUpdate} />

      {/* Norms Section */}
      <SettingsSection
        icon={Flame}
        title="Дневные нормы КБЖУ"
        action={<SaveButton onClick={saveNorms} loading={saving} />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <FormField label="Калории" value={norms.daily_calories} onChange={(v) => setNorms({ ...norms, daily_calories: v })} type="number" placeholder="2000" suffix="ккал" />
          <FormField label="Белки" value={norms.daily_proteins} onChange={(v) => setNorms({ ...norms, daily_proteins: v })} type="number" placeholder="100" suffix="г" />
          <FormField label="Жиры" value={norms.daily_fats} onChange={(v) => setNorms({ ...norms, daily_fats: v })} type="number" placeholder="70" suffix="г" />
          <FormField label="Углеводы" value={norms.daily_carbs} onChange={(v) => setNorms({ ...norms, daily_carbs: v })} type="number" placeholder="250" suffix="г" />
          <FormField label="Вода" value={norms.daily_water} onChange={(v) => setNorms({ ...norms, daily_water: v })} type="number" placeholder="2.0" suffix="л" step="0.1" />
        </div>
      </SettingsSection>
    </div>
  )
}

// Memory section component
function MemorySection({ client, onClientUpdate }: { client: Client; onClientUpdate: (c: Client) => void }) {
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    const content = newItem.trim()
    if (!content) return
    setLoading(true)
    try {
      const { data } = await clientMemoryApi.add(client.id, content)
      onClientUpdate({ ...client, memory: data.memory })
      setNewItem('')
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (index: number) => {
    setLoading(true)
    try {
      const { data } = await clientMemoryApi.remove(client.id, index)
      onClientUpdate({ ...client, memory: data.memory })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsSection icon={Brain} title="Память">
      <p className="text-xs text-muted-foreground mb-3">
        Факты, которые AI всегда учитывает при общении с клиентом
      </p>

      {(client.memory || []).length > 0 && (
        <div className="space-y-2 mb-3">
          {client.memory.map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-card rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-foreground">{item}</span>
              <button
                onClick={() => handleRemove(i)}
                disabled={loading}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Например: не ест глютен, называть Машенькой..."
          className="flex-1 px-3 py-2 text-sm bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow placeholder:text-muted-foreground"
        />
        <button
          onClick={handleAdd}
          disabled={loading || !newItem.trim()}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1 text-sm"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Добавить</span>
        </button>
      </div>
    </SettingsSection>
  )
}

// Reusable settings section component
function SettingsSection({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: typeof User
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="bg-muted rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-muted-foreground" />
          <h3 className="font-medium text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// Form field component
function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
  icon: Icon,
  step,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  suffix?: string
  icon?: typeof User
  step?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          step={step}
          className={`w-full px-3 py-2 text-sm bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow placeholder:text-muted-foreground ${
            Icon ? 'pl-9' : ''
          } ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{suffix}</span>
        )}
      </div>
    </div>
  )
}

// Form select component
function FormSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

// Save button component
function SaveButton({
  onClick,
  loading,
  message,
}: {
  onClick: () => void
  loading: boolean
  message?: string
}) {
  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className={`text-sm ${message.includes('Ошибка') ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </span>
      )}
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        <Save size={14} />
        {loading ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>
  )
}
