import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { clientsApi } from '../api/clients'
import { settingsApi } from '../api/settings'
import { mealsApi, metricsApi, chatApi } from '../api/data'
import type { Client, Meal, HealthMetric, ChatMessage, BotPersona } from '../types'
import dayjs from 'dayjs'

type Tab = 'meals' | 'metrics' | 'chat'

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
      const { data } = await clientsApi.update(clientId, profile)
      setClient(data)
      setProfileMsg('Сохранено')
    } catch {
      setProfileMsg('Ошибка сохранения')
    } finally {
      setSavingProfile(false)
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/clients" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {client.first_name} {client.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabels[client.status]?.cls}`}>
                {statusLabels[client.status]?.label}
              </span>
              {client.telegram_username && (
                <span className="text-sm text-gray-500">@{client.telegram_username}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
        >
          <Trash2 size={16} />
          Удалить
        </button>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Профиль</h3>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="text-xs text-gray-500">Имя</label>
            <input
              type="text"
              value={profile.first_name}
              onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Фамилия</label>
            <input
              type="text"
              value={profile.last_name}
              onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Город</label>
            <input
              type="text"
              value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
              placeholder="Москва"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Таймзона</label>
            <input
              type="text"
              value={profile.timezone}
              onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
              placeholder="Europe/Moscow"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs text-gray-500">Статус</label>
          <select
            value={profile.status}
            onChange={(e) => setProfile({ ...profile, status: e.target.value })}
            className="mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
          >
            <option value="pending">Ожидает</option>
            <option value="active">Активен</option>
            <option value="paused">На паузе</option>
            <option value="archived">Архив</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} />
            {savingProfile ? 'Сохранение...' : 'Сохранить профиль'}
          </button>
          {profileMsg && (
            <span className={`text-sm ${profileMsg.includes('Ошибка') ? 'text-red-600' : 'text-green-600'}`}>
              {profileMsg}
            </span>
          )}
        </div>
      </div>

      {/* Persona */}
      {personas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Персона</h3>
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
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Нормы КБЖУ</h3>
        <div className="grid grid-cols-5 gap-3">
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
          className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['meals', 'metrics', 'chat'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'meals' ? 'Питание' : t === 'metrics' ? 'Метрики' : 'Чат'}
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
      ) : (
        <ChatTab messages={messages} />
      )}
    </div>
  )
}

function MealsTab({ meals }: { meals: Meal[] }) {
  if (!meals.length) {
    return <p className="text-sm text-gray-400 py-4">Нет записей о питании</p>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
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
            <tr key={m.id} className="border-b border-gray-100">
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

function ChatTab({ messages }: { messages: ChatMessage[] }) {
  if (!messages.length) {
    return <p className="text-sm text-gray-400 py-4">Нет сообщений</p>
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
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
    </div>
  )
}
