import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, MapPin, Clock, Send } from 'lucide-react'
import { clientsApi } from '../api/clients'
import { settingsApi } from '../api/settings'
import { mealsApi, metricsApi, chatApi } from '../api/data'
import type { Client, Meal, HealthMetric, ChatMessage, BotPersona } from '../types'
import dayjs from 'dayjs'

const timezoneOptions = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва / Санкт-Петербург (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара / Ижевск (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург / Челябинск / Уфа (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск / Томск / Барнаул (UTC+7)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск / Кемерово (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск / Улан-Удэ (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск / Чита (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток / Хабаровск (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан / Сахалин (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Петропавловск-Камчатский (UTC+12)' },
]

type Tab = 'meals' | 'metrics' | 'chat' | 'settings'

const statusLabels: Record<string, { label: string; cls: string }> = {
  active: { label: 'Активен', cls: 'bg-green-100 text-green-700' },
  pending: { label: 'Ожидает', cls: 'bg-yellow-100 text-yellow-700' },
  paused: { label: 'На паузе', cls: 'bg-gray-100 text-gray-700' },
  archived: { label: 'Архив', cls: 'bg-red-100 text-red-700' },
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

  // Editable profile
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    city: '',
    timezone: '',
    status: 'pending' as string,
  })

  // Physiology
  const [physiology, setPhysiology] = useState({
    height: '',
    weight: '',
    birth_date: '',
  })
  const [savingPhysiology, setSavingPhysiology] = useState(false)
  const [physiologyMsg, setPhysiologyMsg] = useState('')

  // Editable norms
  const [norms, setNorms] = useState({
    daily_calories: '',
    daily_proteins: '',
    daily_fats: '',
    daily_carbs: '',
    daily_water: '',
  })

  // Personas
  const [personas, setPersonas] = useState<BotPersona[]>([])

  // Tab data
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
    } else {
      chatApi.messages(clientId)
        .then(({ data }) => setMessages(data.results))
        .finally(() => setTabLoading(false))
    }
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    setProfileMsg('')
    try {
      const { data } = await clientsApi.update(clientId, profile as Partial<Client>)
      setClient(data)
      setProfileMsg('Сохранено')
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
    } catch {
      setPhysiologyMsg('Ошибка сохранения')
    } finally {
      setSavingPhysiology(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Удалить клиента? Все его данные (питание, метрики, чат) будут удалены.')) return
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
      const payload = {
        daily_calories: norms.daily_calories ? Number(norms.daily_calories) : null,
        daily_proteins: norms.daily_proteins ? Number(norms.daily_proteins) : null,
        daily_fats: norms.daily_fats ? Number(norms.daily_fats) : null,
        daily_carbs: norms.daily_carbs ? Number(norms.daily_carbs) : null,
        daily_water: norms.daily_water ? Number(norms.daily_water) : null,
      }
      const { data } = await clientsApi.update(clientId, payload)
      setClient(data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-500">Загрузка...</div>
  if (!client) return <div className="text-gray-500">Клиент не найден</div>

  const initials = `${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}`.toUpperCase() || '?'

  return (
    <div>
      {/* Back button */}
      <div className="mb-4">
        <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} />
          Клиенты
        </Link>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
        {/* Gradient banner */}
        <div className="h-24 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Avatar + info */}
        <div className="px-6 pb-6">
          <div className="flex items-end gap-5 -mt-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 border-4 border-white shadow-lg flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {client.first_name} {client.last_name}
                </h1>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusLabels[client.status]?.cls}`}>
                  {statusLabels[client.status]?.label}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                {client.telegram_username && (
                  <span className="flex items-center gap-1">
                    <Send size={13} className="text-gray-400" />
                    @{client.telegram_username}
                  </span>
                )}
                {client.city && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-gray-400" />
                    {client.city}
                  </span>
                )}
                {client.timezone && (
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-gray-400" />
                    {timezoneOptions.find((tz) => tz.value === client.timezone)?.label || client.timezone}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              Удалить
            </button>
          </div>

        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['meals', 'metrics', 'chat', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'meals' ? 'Питание' : t === 'metrics' ? 'Метрики' : t === 'chat' ? 'Чат' : 'Настройки'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tabLoading ? (
        <div className="text-gray-500 py-4">Загрузка...</div>
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
  )
}

function MealsTab({ meals }: { meals: Meal[] }) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)

  if (!meals.length) {
    return <p className="text-sm text-gray-400 py-4">Нет записей о питании</p>
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-16">Фото</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Время</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Блюдо</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Тип</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Ккал</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Б</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Ж</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">У</th>
            </tr>
          </thead>
          <tbody>
            {meals.map((m) => (
              <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedMeal(m)}>
                <td className="px-4 py-2">
                  {m.image ? (
                    <img
                      src={m.image}
                      alt={m.dish_name}
                      className="w-12 h-12 object-cover rounded-lg hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400 text-xs">—</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">
                  {dayjs(m.meal_time).format('DD.MM HH:mm')}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900">{m.dish_name}</td>
                <td className="px-4 py-2 text-sm text-gray-500">{m.dish_type}</td>
                <td className="px-4 py-2 text-sm text-right">{m.calories ? Math.round(m.calories) : '—'}</td>
                <td className="px-4 py-2 text-sm text-right">{m.proteins ? Math.round(m.proteins) : '—'}</td>
                <td className="px-4 py-2 text-sm text-right">{m.fats ? Math.round(m.fats) : '—'}</td>
                <td className="px-4 py-2 text-sm text-right">{m.carbohydrates ? Math.round(m.carbohydrates) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Meal detail modal */}
      {selectedMeal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMeal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with image */}
            <div className="relative bg-gray-900">
              {selectedMeal.image ? (
                <img
                  src={selectedMeal.image}
                  alt={selectedMeal.dish_name}
                  className="w-full max-h-[60vh] object-contain"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-lg">Нет фото</span>
                </div>
              )}
              <button
                onClick={() => setSelectedMeal(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
              >
                ×
              </button>
              {selectedMeal.ai_confidence && (
                <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  AI: {selectedMeal.ai_confidence}%
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-16rem)]">
              {/* Title and time */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">{selectedMeal.dish_name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {dayjs(selectedMeal.meal_time).format('DD MMMM YYYY, HH:mm')}
                  {selectedMeal.dish_type && <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">{selectedMeal.dish_type}</span>}
                </p>
              </div>

              {/* KBJU Cards */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {selectedMeal.calories ? Math.round(selectedMeal.calories) : '—'}
                  </div>
                  <div className="text-xs text-orange-600/70 mt-1">ккал</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {selectedMeal.proteins ? Math.round(selectedMeal.proteins) : '—'}
                  </div>
                  <div className="text-xs text-red-600/70 mt-1">белки, г</div>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {selectedMeal.fats ? Math.round(selectedMeal.fats) : '—'}
                  </div>
                  <div className="text-xs text-yellow-600/70 mt-1">жиры, г</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {selectedMeal.carbohydrates ? Math.round(selectedMeal.carbohydrates) : '—'}
                  </div>
                  <div className="text-xs text-green-600/70 mt-1">углеводы, г</div>
                </div>
              </div>

              {/* Ingredients */}
              {selectedMeal.ingredients && selectedMeal.ingredients.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Ингредиенты</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedMeal.ingredients.map((ing, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional info */}
              {(selectedMeal.plate_type || selectedMeal.layout || selectedMeal.decorations) && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Дополнительно</h3>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {selectedMeal.plate_type && (
                      <div className="flex">
                        <span className="text-gray-500 w-24">Подача:</span>
                        <span className="text-gray-700">{selectedMeal.plate_type}</span>
                      </div>
                    )}
                    {selectedMeal.layout && (
                      <div className="flex">
                        <span className="text-gray-500 w-24">Выкладка:</span>
                        <span className="text-gray-700">{selectedMeal.layout}</span>
                      </div>
                    )}
                    {selectedMeal.decorations && (
                      <div className="flex">
                        <span className="text-gray-500 w-24">Декор:</span>
                        <span className="text-gray-700">{selectedMeal.decorations}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MetricsTab({ metrics }: { metrics: HealthMetric[] }) {
  if (!metrics.length) {
    return <p className="text-sm text-gray-400 py-4">Нет записей метрик</p>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Дата</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Тип</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Значение</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Источник</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.id} className="border-b border-gray-100">
              <td className="px-4 py-2 text-sm text-gray-500">
                {dayjs(m.recorded_at).format('DD.MM.YYYY HH:mm')}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900">{m.metric_type}</td>
              <td className="px-4 py-2 text-sm text-right">{m.value} {m.unit}</td>
              <td className="px-4 py-2 text-sm text-gray-500">{m.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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

  // Автопрокрутка вниз
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Polling каждые 5 секунд
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div>
      {/* Toggle manual mode */}
      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={toggling ? undefined : toggleManualMode}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              client.manual_mode ? 'bg-blue-600' : 'bg-gray-300'
            } ${toggling ? 'opacity-50' : 'cursor-pointer'}`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                client.manual_mode ? 'translate-x-5' : ''
              }`}
            />
          </div>
          <span className="text-sm text-gray-700">Ручной режим</span>
        </label>
      </div>

      {/* Messages */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {!messages.length && <p className="text-sm text-gray-400 py-4">Нет сообщений</p>}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-xl px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-100 text-blue-900'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs text-gray-400 mt-1">
                {dayjs(msg.created_at).format('DD.MM HH:mm')}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input field — visible only in manual mode */}
      {client.manual_mode && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Написать клиенту..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
            {sending ? '...' : 'Отправить'}
          </button>
        </div>
      )}
    </div>
  )
}

interface SettingsTabProps {
  client: Client
  onClientUpdate: (c: Client) => void
  profile: { first_name: string; last_name: string; city: string; timezone: string; status: string }
  setProfile: (p: { first_name: string; last_name: string; city: string; timezone: string; status: string }) => void
  saveProfile: () => Promise<void>
  savingProfile: boolean
  profileMsg: string
  physiology: { height: string; weight: string; birth_date: string }
  setPhysiology: (p: { height: string; weight: string; birth_date: string }) => void
  savePhysiology: () => Promise<void>
  savingPhysiology: boolean
  physiologyMsg: string
  personas: BotPersona[]
  handlePersonaChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  norms: { daily_calories: string; daily_proteins: string; daily_fats: string; daily_carbs: string; daily_water: string }
  setNorms: (n: { daily_calories: string; daily_proteins: string; daily_fats: string; daily_carbs: string; daily_water: string }) => void
  saveNorms: () => Promise<void>
  saving: boolean
  timezoneOptions: { value: string; label: string }[]
}

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
}: SettingsTabProps) {
  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Профиль</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Имя</label>
            <input
              type="text"
              value={profile.first_name}
              onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Фамилия</label>
            <input
              type="text"
              value={profile.last_name}
              onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Город</label>
            <input
              type="text"
              value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Москва"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Статус</label>
            <select
              value={profile.status}
              onChange={(e) => setProfile({ ...profile, status: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="pending">Ожидает</option>
              <option value="active">Активен</option>
              <option value="paused">На паузе</option>
              <option value="archived">Архив</option>
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Часовой пояс</label>
          <select
            value={profile.timezone}
            onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Не указан</option>
            {!timezoneOptions.find((tz) => tz.value === profile.timezone) && profile.timezone && (
              <option value={profile.timezone}>{profile.timezone}</option>
            )}
            {timezoneOptions.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {savingProfile ? 'Сохранение...' : 'Сохранить'}
          </button>
          {profileMsg && (
            <span className={`text-sm ${profileMsg.includes('Ошибка') ? 'text-red-600' : 'text-green-600'}`}>
              {profileMsg}
            </span>
          )}
        </div>
      </div>

      {/* Physiology */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Физиологические данные</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Рост (см)</label>
            <input
              type="number"
              value={physiology.height}
              onChange={(e) => setPhysiology({ ...physiology, height: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="170"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Вес (кг)</label>
            <input
              type="number"
              step="0.1"
              value={physiology.weight}
              onChange={(e) => setPhysiology({ ...physiology, weight: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="70"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Дата рождения</label>
            <input
              type="date"
              value={physiology.birth_date}
              onChange={(e) => setPhysiology({ ...physiology, birth_date: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={savePhysiology}
            disabled={savingPhysiology}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {savingPhysiology ? 'Сохранение...' : 'Сохранить'}
          </button>
          {physiologyMsg && (
            <span className={`text-sm ${physiologyMsg.includes('Ошибка') ? 'text-red-600' : 'text-green-600'}`}>
              {physiologyMsg}
            </span>
          )}
        </div>
      </div>

      {/* Persona */}
      {personas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Персона бота</h3>
          <select
            value={client.persona ?? ''}
            onChange={handlePersonaChange}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="">По умолчанию</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.is_default ? ' (по умолч.)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Norms */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Нормы КБЖУ</h3>
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500">Калории</label>
            <input
              type="number"
              value={norms.daily_calories}
              onChange={(e) => setNorms({ ...norms, daily_calories: e.target.value })}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              placeholder="2000"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Белки (г)</label>
            <input
              type="number"
              value={norms.daily_proteins}
              onChange={(e) => setNorms({ ...norms, daily_proteins: e.target.value })}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              placeholder="100"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Жиры (г)</label>
            <input
              type="number"
              value={norms.daily_fats}
              onChange={(e) => setNorms({ ...norms, daily_fats: e.target.value })}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              placeholder="70"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Углеводы (г)</label>
            <input
              type="number"
              value={norms.daily_carbs}
              onChange={(e) => setNorms({ ...norms, daily_carbs: e.target.value })}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              placeholder="250"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Вода (л)</label>
            <input
              type="number"
              step="0.1"
              value={norms.daily_water}
              onChange={(e) => setNorms({ ...norms, daily_water: e.target.value })}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              placeholder="2.0"
            />
          </div>
        </div>
        <button
          onClick={saveNorms}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save size={14} />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
