import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Save, Trash2, MapPin, Clock, Send,
  ChevronDown, ChevronRight, Utensils, Activity,
  MessageCircle, Settings, Calendar, Flame, Beef,
  Droplets, Wheat, User, Scale, Ruler, Cake
} from 'lucide-react'
import { clientsApi } from '../api/clients'
import { settingsApi } from '../api/settings'
import { mealsApi, metricsApi, chatApi } from '../api/data'
import type { Client, Meal, HealthMetric, ChatMessage, BotPersona } from '../types'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

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

type Tab = 'meals' | 'metrics' | 'chat' | 'settings'

const tabs: { id: Tab; label: string; icon: typeof Utensils }[] = [
  { id: 'meals', label: 'Питание', icon: Utensils },
  { id: 'metrics', label: 'Метрики', icon: Activity },
  { id: 'chat', label: 'Чат', icon: MessageCircle },
  { id: 'settings', label: 'Настройки', icon: Settings },
]

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'Активен', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending: { label: 'Ожидает', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  paused: { label: 'На паузе', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  archived: { label: 'Архив', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
}

// Loading skeleton component
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
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
    height: '',
    weight: '',
    birth_date: '',
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
          height: data.height?.toString() || '',
          weight: data.weight?.toString() || '',
          birth_date: data.birth_date || '',
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
      metricsApi.list({ client_id: clientId })
        .then(({ data }) => setMetrics(data))
        .finally(() => setTabLoading(false))
    } else if (tab === 'chat') {
      chatApi.messages(clientId)
        .then(({ data }) => setMessages(data.results))
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
        height: physiology.height ? Number(physiology.height) : null,
        weight: physiology.weight ? Number(physiology.weight) : null,
        birth_date: physiology.birth_date || null,
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
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">Клиент не найден</h2>
        <Link to="/clients" className="text-blue-600 hover:text-blue-700 text-sm">
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
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        Клиенты
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Gradient banner */}
        <div className="h-28 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600" />

        {/* Profile content */}
        <div className="px-6 pb-6">
          <div className="flex items-end gap-5 -mt-14">
            {/* Avatar */}
            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 border-4 border-white shadow-lg flex items-center justify-center shrink-0">
              <span className="text-3xl font-bold text-white">{initials}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">
                  {client.first_name} {client.last_name}
                </h1>
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${status.bg} ${status.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                {client.telegram_username && (
                  <span className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
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
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} />
                    {timezoneOptions.find((tz) => tz.value === client.timezone)?.label || client.timezone}
                  </span>
                )}
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Удалить</span>
            </button>
          </div>

          {/* Quick stats */}
          {client.daily_calories && (
            <div className="mt-6 pt-6 border-t border-gray-100">
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex border-b border-gray-200">
          {tabs.map((t) => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all relative ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} />
                <span className="hidden sm:inline">{t.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
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
            <MetricsTab metrics={metrics} />
          ) : tab === 'chat' ? (
            <ChatTab
              messages={messages}
              client={client}
              onClientUpdate={setClient}
              onMessagesUpdate={setMessages}
            />
          ) : (
            <SettingsTab
              client={client}
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
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
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
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Utensils className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">Нет записей о питании</h3>
        <p className="text-sm text-gray-500">Данные появятся когда клиент начнёт отправлять фото еды</p>
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
                isExpanded ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Date header */}
              <button
                onClick={() => toggleDate(date)}
                className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  <div className="text-left">
                    <span className="font-medium text-gray-900 capitalize">{dateLabel}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {dayMeals.length} {dayMeals.length === 1 ? 'приём' : dayMeals.length < 5 ? 'приёма' : 'приёмов'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 text-sm">
                  <span className="font-semibold text-orange-600">{Math.round(totals.calories)}</span>
                  <span className="text-gray-400 hidden sm:inline">|</span>
                  <div className="hidden sm:flex items-center gap-3 text-gray-500">
                    <span>Б: {Math.round(totals.proteins)}</span>
                    <span>Ж: {Math.round(totals.fats)}</span>
                    <span>У: {Math.round(totals.carbs)}</span>
                  </div>
                </div>
              </button>

              {/* Meals list */}
              {isExpanded && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {dayMeals.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMeal(m)}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-white cursor-pointer transition-colors"
                    >
                      {m.image ? (
                        <img
                          src={m.image}
                          alt={m.dish_name}
                          className="w-14 h-14 object-cover rounded-xl flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Utensils className="w-6 h-6 text-gray-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">{m.dish_name}</span>
                          {m.dish_type && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full hidden sm:inline">
                              {m.dish_type}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {dayjs(m.meal_time).format('HH:mm')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4 text-sm">
                        <span className="font-medium text-orange-600 min-w-[3rem] text-right">
                          {m.calories ? Math.round(m.calories) : '—'}
                        </span>
                        <div className="hidden sm:flex items-center gap-3 text-gray-500 text-right">
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
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with image */}
        <div className="relative bg-gray-900">
          {meal.image ? (
            <img
              src={meal.image}
              alt={meal.dish_name}
              className="w-full max-h-[50vh] object-contain"
            />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <Utensils className="w-16 h-16 text-gray-600" />
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
            <h2 className="text-xl font-bold text-gray-900">{meal.dish_name}</h2>
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <Calendar size={14} />
              {dayjs(meal.meal_time).format('D MMMM YYYY, HH:mm')}
              {meal.dish_type && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">{meal.dish_type}</span>
              )}
            </div>
          </div>

          {/* KBJU Cards */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { label: 'ккал', value: meal.calories, color: 'bg-orange-50 text-orange-600' },
              { label: 'белки', value: meal.proteins, color: 'bg-red-50 text-red-600' },
              { label: 'жиры', value: meal.fats, color: 'bg-amber-50 text-amber-600' },
              { label: 'углеводы', value: meal.carbohydrates, color: 'bg-emerald-50 text-emerald-600' },
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
              <h3 className="text-sm font-medium text-gray-700 mb-3">Ингредиенты</h3>
              <div className="flex flex-wrap gap-2">
                {meal.ingredients.map((ing, i) => (
                  <span key={i} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional info */}
          {(meal.plate_type || meal.layout || meal.decorations) && (
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Дополнительно</h3>
              <div className="space-y-2 text-sm">
                {meal.plate_type && (
                  <div className="flex"><span className="text-gray-500 w-24">Подача:</span><span>{meal.plate_type}</span></div>
                )}
                {meal.layout && (
                  <div className="flex"><span className="text-gray-500 w-24">Выкладка:</span><span>{meal.layout}</span></div>
                )}
                {meal.decorations && (
                  <div className="flex"><span className="text-gray-500 w-24">Декор:</span><span>{meal.decorations}</span></div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Metrics tab
function MetricsTab({ metrics }: { metrics: HealthMetric[] }) {
  if (!metrics.length) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">Нет записей метрик</h3>
        <p className="text-sm text-gray-500">Здесь будут отображаться показатели здоровья клиента</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Значение</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Источник</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {metrics.map((m) => (
            <tr key={m.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-sm text-gray-500">{dayjs(m.recorded_at).format('D MMM YYYY, HH:mm')}</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.metric_type}</td>
              <td className="px-4 py-3 text-sm text-right font-medium">{m.value} <span className="text-gray-500 font-normal">{m.unit}</span></td>
              <td className="px-4 py-3 text-sm text-gray-500">{m.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={toggling ? undefined : toggleManualMode}
            disabled={toggling}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              client.manual_mode ? 'bg-blue-600' : 'bg-gray-300'
            } ${toggling ? 'opacity-50' : ''}`}
          >
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                client.manual_mode ? 'translate-x-5' : ''
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">Ручной режим</span>
        </div>
        {client.manual_mode && (
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            Бот отключён, вы отвечаете вручную
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
        {!messages.length && (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Нет сообщений</p>
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
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-900 rounded-bl-md'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
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
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputText.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// Settings tab
function SettingsTab({
  client,
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
  profile: { first_name: string; last_name: string; city: string; timezone: string; status: string }
  setProfile: (p: typeof profile) => void
  saveProfile: () => Promise<void>
  savingProfile: boolean
  profileMsg: string
  physiology: { height: string; weight: string; birth_date: string }
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
        <div className="grid grid-cols-3 gap-4">
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
        </div>
      </SettingsSection>

      {/* Persona Section */}
      {personas.length > 0 && (
        <SettingsSection icon={MessageCircle} title="Персона бота">
          <select
            value={client.persona ?? ''}
            onChange={handlePersonaChange}
            className="w-full sm:w-auto px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
          >
            <option value="">По умолчанию</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.is_default ? ' (по умолч.)' : ''}
              </option>
            ))}
          </select>
        </SettingsSection>
      )}

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
    <div className="bg-gray-50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-gray-500" />
          <h3 className="font-medium text-gray-900">{title}</h3>
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
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          step={step}
          className={`w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow ${
            Icon ? 'pl-9' : ''
          } ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>
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
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
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
        <span className={`text-sm ${message.includes('Ошибка') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </span>
      )}
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        <Save size={14} />
        {loading ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>
  )
}
