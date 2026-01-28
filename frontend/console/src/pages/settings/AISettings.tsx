import { useEffect, useState, useRef } from 'react'
import { Key, Layers, SlidersHorizontal, BarChart3, Plus, Trash2, Check, X, MessageSquare, Image as ImageIcon, Loader2, Send, Settings } from 'lucide-react'
import { settingsApi } from '../../api/settings'
import type {
  AIProviderConfig,
  AIModelSelection,
  AIModelConfigEntry,
  AIModelInfo,
  AIUsageStats,
  ProviderType,
} from '../../types'

type TabId = 'providers' | 'models' | 'assignments' | 'usage'

const PROVIDER_LABELS: Record<ProviderType, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic',
}

const PROVIDER_LIST: ProviderType[] = ['openai', 'deepseek', 'anthropic']

// --- Add Provider Modal ---
function AddProviderModal({
  onClose,
  onAdded,
  existingProviders,
}: {
  onClose: () => void
  onAdded: (config: AIProviderConfig, models: AIModelInfo[]) => void
  existingProviders: ProviderType[]
}) {
  const [provider, setProvider] = useState<ProviderType>('openai')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const availableProviders = PROVIDER_LIST.filter(p => !existingProviders.includes(p))

  useEffect(() => {
    if (availableProviders.length > 0 && !availableProviders.includes(provider)) {
      setProvider(availableProviders[0])
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data } = await settingsApi.addProvider(provider, apiKey.trim())
      onAdded(data.provider, data.models)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка добавления провайдера')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Добавить провайдера</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-foreground mb-1">Провайдер</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value as ProviderType)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:border-gray-600 disabled:cursor-not-allowed"
            >
              {availableProviders.map(p => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-foreground mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={provider === 'openai' ? 'sk-...' : provider === 'anthropic' ? 'sk-ant-...' : 'API key'}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:border-gray-600 disabled:cursor-not-allowed"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-secondary-foreground hover:text-foreground">
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !apiKey.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Проверка...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- Add Models Modal ---
function AddModelsModal({
  onClose,
  onAdded,
  providers,
  existingModels,
}: {
  onClose: () => void
  onAdded: (models: AIModelConfigEntry[]) => void
  providers: AIProviderConfig[]
  existingModels: AIModelConfigEntry[]
}) {
  const [provider, setProvider] = useState<ProviderType>(providers[0]?.provider || 'openai')
  const [availableModels, setAvailableModels] = useState<AIModelInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadModels(provider)
  }, [provider])

  const loadModels = async (prov: ProviderType) => {
    setLoading(true)
    setError('')
    setSelected(new Set())
    try {
      const { data } = await settingsApi.fetchModels(prov)
      setAvailableModels(data.models)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка загрузки моделей')
      setAvailableModels([])
    } finally {
      setLoading(false)
    }
  }

  const isAlreadyAdded = (modelId: string) => {
    return existingModels.some(m => m.provider === provider && m.model_id === modelId)
  }

  const toggleModel = (modelId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(modelId)) {
        next.delete(modelId)
      } else {
        next.add(modelId)
      }
      return next
    })
  }

  const handleAdd = async () => {
    if (selected.size === 0) return
    setSaving(true)
    setError('')
    try {
      const models = Array.from(selected).map(modelId => {
        const info = availableModels.find(m => m.id === modelId)
        return {
          provider,
          model_id: modelId,
          model_name: info?.name || modelId,
        }
      })
      const { data } = await settingsApi.addModels(models)
      onAdded(data)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка добавления моделей')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Добавить модели</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-secondary-foreground mb-1">Провайдер</label>
          <select
            value={provider}
            onChange={e => setProvider(e.target.value as ProviderType)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:border-gray-600 disabled:cursor-not-allowed"
          >
            {providers.map(p => (
              <option key={p.provider} value={p.provider}>{PROVIDER_LABELS[p.provider]}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground mb-2">Т — текст, Ф — фото, Г — голос. Цена за 1M токенов (вход / выход).</p>
        <div className="flex-1 overflow-y-auto mb-4 border border-border rounded-lg">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">Загрузка моделей...</div>
          ) : availableModels.filter(m => m.price_input !== null).length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">Нет доступных моделей с известной ценой</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {availableModels.filter(m => m.price_input !== null).map(m => {
                const added = isAlreadyAdded(m.id)
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted cursor-pointer ${added ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      disabled={added}
                      onChange={() => toggleModel(m.id)}
                      className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">{m.name}</span>
                      {m.context_length && (
                        <span className="text-xs text-muted-foreground ml-2">{Math.round(m.context_length / 1000)}K</span>
                      )}
                    </div>
                    <span className="flex gap-1 text-xs">
                      <span className={m.supports_text ? 'text-blue-500 font-medium' : 'text-muted-foreground/50'}>Т</span>
                      <span className={m.supports_vision ? 'text-green-500 font-medium' : 'text-muted-foreground/50'}>Ф</span>
                      <span className={m.supports_audio ? 'text-purple-500 font-medium' : 'text-muted-foreground/50'}>Г</span>
                    </span>
                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      ${m.price_input} / ${m.price_output}
                    </span>
                    {added && <span className="text-xs text-muted-foreground ml-1">добавлена</span>}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-secondary-foreground hover:text-foreground">
            Отмена
          </button>
          <button
            onClick={handleAdd}
            disabled={saving || selected.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Добавление...' : `Добавить (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Get model price display ---
// --- Tab Config ---
const TABS: { id: TabId; label: string; icon: typeof Key }[] = [
  { id: 'providers', label: 'Провайдеры', icon: Key },
  { id: 'models', label: 'Модели', icon: Layers },
  { id: 'assignments', label: 'Назначения', icon: SlidersHorizontal },
  { id: 'usage', label: 'Статистика', icon: BarChart3 },
]

// --- Main Component ---
export default function AISettings() {
  const [activeTab, setActiveTab] = useState<TabId>('providers')
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [addedModels, setAddedModels] = useState<AIModelConfigEntry[]>([])
  const [settings, setSettings] = useState<AIModelSelection>({
    text_provider: '', text_model: '',
    vision_provider: '', vision_model: '',
    voice_provider: '', voice_model: '',
    temperature: 0.7, max_tokens: 600,
  })
  const [usageStats, setUsageStats] = useState<AIUsageStats[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [usagePeriod, setUsagePeriod] = useState('month')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [openaiUsage, setOpenaiUsage] = useState<any>(null)
  const [loadingOpenai, setLoadingOpenai] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showAddProviderModal, setShowAddProviderModal] = useState(false)
  const [showAddModelsModal, setShowAddModelsModal] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [deletingModel, setDeletingModel] = useState<number | null>(null)
  const [editingAdminKey, setEditingAdminKey] = useState<AIProviderConfig | null>(null)
  const [adminKeyValue, setAdminKeyValue] = useState('')
  const [savingAdminKey, setSavingAdminKey] = useState(false)
  const [testing, setTesting] = useState<'text' | 'vision' | null>(null)
  const [testError, setTestError] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; model?: string }[]>([])
  const chatMessagesRef = useRef(chatMessages)
  chatMessagesRef.current = chatMessages
  const [chatInput, setChatInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadUsage()
  }, [usagePeriod])

  useEffect(() => {
    if (activeTab === 'usage' && providers.length > 0) {
      loadOpenAIUsage()
    }
  }, [activeTab, providers, usagePeriod])

  const loadData = async () => {
    try {
      const [provRes, aiRes, modelsRes] = await Promise.all([
        settingsApi.getProviders(),
        settingsApi.getAISettings(),
        settingsApi.getModels(),
      ])
      setProviders(provRes.data)
      setSettings(aiRes.data)
      setAddedModels(modelsRes.data)
    } finally {
      setLoading(false)
    }
  }

  const loadUsage = async () => {
    try {
      const { data } = await settingsApi.getUsageStats(usagePeriod)
      setUsageStats(data.stats)
      setTotalCost(data.total_cost_usd)
    } catch {}
  }

  const loadOpenAIUsage = async () => {
    // Check if OpenAI provider is configured
    const hasOpenAI = providers.some(p => p.provider === 'openai')
    if (!hasOpenAI) {
      setOpenaiUsage(null)
      return
    }

    setLoadingOpenai(true)
    try {
      // Calculate date range based on usagePeriod
      const now = new Date()
      let startDate: string
      const endDate = now.toISOString().split('T')[0]

      if (usagePeriod === 'today') {
        startDate = endDate
      } else if (usagePeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        startDate = weekAgo.toISOString().split('T')[0]
      } else if (usagePeriod === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        startDate = monthAgo.toISOString().split('T')[0]
      } else {
        // 'all' - last 90 days (OpenAI API limit)
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        startDate = threeMonthsAgo.toISOString().split('T')[0]
      }

      const { data } = await settingsApi.getOpenAIUsage(startDate, endDate)
      setOpenaiUsage(data)
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Не удалось загрузить данные из OpenAI'
      setOpenaiUsage({ usage: {}, costs: {}, error: errorMsg })
    } finally {
      setLoadingOpenai(false)
    }
  }

  const handleProviderAdded = (config: AIProviderConfig, _models: AIModelInfo[]) => {
    setProviders(prev => [...prev.filter(p => p.provider !== config.provider), config])
  }

  const handleDeleteProvider = async (id: number, provider: ProviderType) => {
    if (!confirm(`Удалить провайдера ${PROVIDER_LABELS[provider]}? Все добавленные модели этого провайдера тоже будут удалены.`)) return
    setDeleting(id)
    try {
      await settingsApi.deleteProvider(id)
      setProviders(prev => prev.filter(p => p.id !== id))
      // Remove models for this provider from local state
      setAddedModels(prev => prev.filter(m => m.provider !== provider))
      // Clear selections for this provider
      setSettings(prev => {
        const updated = { ...prev }
        if (updated.text_provider === provider) { updated.text_provider = ''; updated.text_model = '' }
        if (updated.vision_provider === provider) { updated.vision_provider = ''; updated.vision_model = '' }
        if (updated.voice_provider === provider) { updated.voice_provider = ''; updated.voice_model = '' }
        return updated
      })
    } finally {
      setDeleting(null)
    }
  }

  const handleModelsAdded = (models: AIModelConfigEntry[]) => {
    setAddedModels(prev => {
      const existing = new Set(prev.map(m => `${m.provider}:${m.model_id}`))
      const newModels = models.filter(m => !existing.has(`${m.provider}:${m.model_id}`))
      return [...prev, ...newModels]
    })
  }

  const handleDeleteModel = async (id: number) => {
    const model = addedModels.find(m => m.id === id)
    if (!model) return
    if (!confirm(`Удалить модель ${model.model_name}?`)) return
    setDeletingModel(id)
    try {
      await settingsApi.deleteModel(id)
      setAddedModels(prev => prev.filter(m => m.id !== id))
      // Clear selections if this model was assigned
      setSettings(prev => {
        const updated = { ...prev }
        if (updated.text_provider === model.provider && updated.text_model === model.model_id) {
          updated.text_provider = ''; updated.text_model = ''
        }
        if (updated.vision_provider === model.provider && updated.vision_model === model.model_id) {
          updated.vision_provider = ''; updated.vision_model = ''
        }
        if (updated.voice_provider === model.provider && updated.voice_model === model.model_id) {
          updated.voice_provider = ''; updated.voice_model = ''
        }
        return updated
      })
    } finally {
      setDeletingModel(null)
    }
  }

  const handleSaveAdminKey = async () => {
    if (!editingAdminKey) return
    setSavingAdminKey(true)
    try {
      const { data } = await settingsApi.updateProviderAdminKey(editingAdminKey.id, adminKeyValue)
      // Update provider in state
      setProviders(prev => prev.map(p =>
        p.id === editingAdminKey.id ? { ...p, has_admin_key: data.has_admin_key } : p
      ))
      setEditingAdminKey(null)
      setAdminKeyValue('')
      // Reload OpenAI usage data
      if (editingAdminKey.provider === 'openai') {
        loadOpenAIUsage()
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка сохранения ключа')
    } finally {
      setSavingAdminKey(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    setMessage('')
    try {
      await settingsApi.updateAISettings(settings)
      setMessage('Настройки сохранены')
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleSendChat = async () => {
    const text = chatInput.trim()
    if (!text || testing === 'text') return
    const userMessage = { role: 'user', content: text }
    const updatedMessages = [...chatMessagesRef.current, userMessage]
    setChatMessages(updatedMessages)
    chatMessagesRef.current = updatedMessages
    setChatInput('')
    setTesting('text')
    setTestError('')
    try {
      const apiMessages = updatedMessages.map(({ role, content }) => ({ role, content }))
      const { data } = await settingsApi.testChat(apiMessages)
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response, model: data.model }])
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Ошибка отправки'
      setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ ${errorMsg}` }])
    } finally {
      setTesting(null)
    }
  }

  const handleTestVision = async (file: File) => {
    setTesting('vision')
    setTestError('')
    setChatMessages(prev => [...prev, { role: 'user', content: `📷 ${file.name}` }])
    try {
      const { data } = await settingsApi.testVision(file)
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response, model: data.model }])
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Ошибка тестирования'
      setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ ${errorMsg}` }])
    } finally {
      setTesting(null)
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">AI настройки</h1>
        <p className="text-muted-foreground mt-1">Управляйте провайдерами, моделями и назначениями для вашего бота</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-secondary p-1 rounded-xl mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                isActive
                  ? 'bg-card text-blue-600 shadow-sm'
                  : 'text-muted-foreground hover:text-secondary-foreground hover:bg-muted'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab: Providers */}
      {activeTab === 'providers' && (
        <section className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Подключённые провайдеры</h2>
              <p className="text-sm text-muted-foreground mt-0.5">API-ключи для доступа к моделям</p>
            </div>
            <button
              onClick={() => setShowAddProviderModal(true)}
              disabled={providers.length >= 4}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Добавить
            </button>
          </div>

          {providers.length === 0 ? (
            <div className="text-center py-10 bg-muted rounded-lg border border-dashed border-border">
              <Key size={32} className="mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">Нет подключённых провайдеров</p>
              <p className="text-muted-foreground text-xs mt-1">Добавьте хотя бы одного для работы AI</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {providers.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${p.is_active ? 'bg-green-500 shadow-sm shadow-green-200' : 'bg-gray-400'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{PROVIDER_LABELS[p.provider]}</span>
                        {p.provider === 'openai' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${p.has_admin_key ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {p.has_admin_key ? 'Admin ✓' : 'Нет Admin key'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{p.masked_key}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.provider === 'openai' && (
                      <button
                        onClick={() => {
                          setEditingAdminKey(p)
                          setAdminKeyValue('')
                        }}
                        className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Settings size={14} />
                        Admin key
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteProvider(p.id, p.provider)}
                      disabled={deleting === p.id}
                      className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {deleting === p.id ? '...' : 'Удалить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab: Models */}
      {activeTab === 'models' && (
        <section className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Пул моделей проекта</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Модели, доступные для назначения на задачи</p>
            </div>
            <button
              onClick={() => setShowAddModelsModal(true)}
              disabled={providers.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Добавить модель
            </button>
          </div>

          {addedModels.length === 0 ? (
            <div className="text-center py-10 bg-muted rounded-lg border border-dashed border-border">
              <Layers size={32} className="mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">
                {providers.length === 0
                  ? 'Сначала подключите провайдера на вкладке «Провайдеры»'
                  : 'Добавьте модели из доступных у ваших провайдеров'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(addedModels.reduce((acc, m) => {
                if (!acc[m.provider]) acc[m.provider] = []
                acc[m.provider].push(m)
                return acc
              }, {} as Record<string, typeof addedModels>)).map(([prov, models]) => (
                <div key={prov}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {PROVIDER_LABELS[prov as ProviderType] || prov}
                  </h3>
                  <div className="grid gap-2">
                    {models.map(m => {
                      const isAssigned = (
                        (settings.text_provider === m.provider && settings.text_model === m.model_id) ||
                        (settings.vision_provider === m.provider && settings.vision_model === m.model_id) ||
                        (settings.voice_provider === m.provider && settings.voice_model === m.model_id)
                      )
                      return (
                        <div key={m.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isAssigned ? 'bg-blue-50/50 border-blue-100' : 'bg-muted border-border/50 hover:border-border'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{m.model_name}</span>
                              {isAssigned && <Check size={14} className="text-blue-500" />}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex gap-1.5 text-xs">
                                <span className={m.supports_text ? 'text-blue-500 font-medium' : 'text-muted-foreground/50'}>Текст</span>
                                <span className={m.supports_vision ? 'text-green-500 font-medium' : 'text-muted-foreground/50'}>Фото</span>
                                <span className={m.supports_audio ? 'text-purple-500 font-medium' : 'text-muted-foreground/50'}>Голос</span>
                              </span>
                              {m.price_input !== null && (
                                <span className="text-xs text-muted-foreground font-mono">${m.price_input} / ${m.price_output}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteModel(m.id)}
                            disabled={deletingModel === m.id}
                            className="flex items-center gap-1 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ml-3"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab: Assignments */}
      {activeTab === 'assignments' && (
        <section className="bg-card rounded-xl border border-border p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Назначение моделей на задачи</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Выберите, какая модель будет обрабатывать каждый тип запросов</p>
          </div>

          {addedModels.length === 0 ? (
            <div className="text-center py-10 bg-muted rounded-lg border border-dashed border-border">
              <SlidersHorizontal size={32} className="mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">Сначала добавьте модели на вкладке «Модели»</p>
            </div>
          ) : (
            <>
              {/* Current assignments summary */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {([
                  { key: 'text' as const, label: 'Текст', desc: 'Текстовые сообщения', activeClass: 'border-blue-200 bg-blue-50', activeLabel: 'text-blue-600', icon: '💬' },
                  { key: 'vision' as const, label: 'Фото', desc: 'Анализ изображений', activeClass: 'border-green-200 bg-green-50', activeLabel: 'text-green-600', icon: '📷' },
                  { key: 'voice' as const, label: 'Голос', desc: 'Голосовые сообщения', activeClass: 'border-purple-200 bg-purple-50', activeLabel: 'text-purple-600', icon: '🎙' },
                ]).map(task => {
                  const provKey = `${task.key}_provider` as keyof AIModelSelection
                  const modelKey = `${task.key}_model` as keyof AIModelSelection
                  const assigned = settings[provKey] && settings[modelKey]
                  const model = assigned ? addedModels.find(m => m.provider === settings[provKey] && m.model_id === settings[modelKey]) : null
                  return (
                    <div key={task.key} className={`p-4 rounded-xl border-2 transition-all ${assigned ? task.activeClass : 'border-border bg-muted'}`}>
                      <div className="text-lg mb-1">{task.icon}</div>
                      <div className={`text-xs font-semibold uppercase tracking-wide ${assigned ? task.activeLabel : 'text-muted-foreground'}`}>
                        {task.label}
                      </div>
                      <div className="text-sm text-foreground mt-1 truncate font-medium">
                        {model ? model.model_name : <span className="text-muted-foreground italic font-normal">—</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{task.desc}</div>
                    </div>
                  )
                })}
              </div>

              {/* Model cards */}
              <div className="space-y-3">
                {addedModels.map(m => {
                  const isText = settings.text_provider === m.provider && settings.text_model === m.model_id
                  const isVision = settings.vision_provider === m.provider && settings.vision_model === m.model_id
                  const isVoice = settings.voice_provider === m.provider && settings.voice_model === m.model_id
                  const isAssigned = isText || isVision || isVoice

                  const toggleFunction = (fn: 'text' | 'vision' | 'voice') => {
                    setSettings(s => {
                      const provKey = `${fn}_provider` as keyof typeof s
                      const modelKey = `${fn}_model` as keyof typeof s
                      if (s[provKey] === m.provider && s[modelKey] === m.model_id) {
                        return { ...s, [provKey]: '', [modelKey]: '' }
                      }
                      return { ...s, [provKey]: m.provider, [modelKey]: m.model_id }
                    })
                  }

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-xl border-2 transition-all ${isAssigned ? 'border-blue-200 bg-gradient-to-r from-blue-50/50 to-white shadow-sm' : 'border-border/50 bg-card hover:border-border'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{m.model_name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                              {PROVIDER_LABELS[m.provider]}
                            </span>
                            {m.context_length && (
                              <span className="text-xs text-muted-foreground">{Math.round(m.context_length / 1000)}K ctx</span>
                            )}
                          </div>
                          {m.price_input !== null && (
                            <div className="text-xs text-muted-foreground mt-1">
                              ${m.price_input} вход / ${m.price_output} выход за 1M токенов
                            </div>
                          )}
                        </div>
                        {isAssigned && <Check size={18} className="text-blue-500 mt-0.5" />}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {m.supports_text ? (
                          <button
                            onClick={() => toggleFunction('text')}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                              isText
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                : 'bg-secondary text-secondary-foreground hover:bg-blue-50 hover:text-blue-600'
                            }`}
                          >
                            {isText && <Check size={12} />}
                            Текст
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground/50 cursor-not-allowed">
                            <X size={12} />
                            Текст
                          </span>
                        )}
                        {m.supports_vision ? (
                          <button
                            onClick={() => toggleFunction('vision')}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                              isVision
                                ? 'bg-green-600 text-white shadow-sm shadow-green-200'
                                : 'bg-secondary text-secondary-foreground hover:bg-green-50 hover:text-green-600'
                            }`}
                          >
                            {isVision && <Check size={12} />}
                            Фото
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground/50 cursor-not-allowed">
                            <X size={12} />
                            Фото
                          </span>
                        )}
                        {m.supports_audio ? (
                          <button
                            onClick={() => toggleFunction('voice')}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                              isVoice
                                ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                                : 'bg-secondary text-secondary-foreground hover:bg-purple-50 hover:text-purple-600'
                            }`}
                          >
                            {isVoice && <Check size={12} />}
                            Голос
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground/50 cursor-not-allowed">
                            <X size={12} />
                            Голос
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Parameters */}
          <div className="mt-6 pt-5 border-t border-border">
            <h3 className="text-sm font-semibold text-secondary-foreground mb-4">Параметры генерации</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-muted rounded-lg p-4">
                <label className="block text-sm text-secondary-foreground mb-2">
                  Температура: <span className="font-semibold text-foreground">{settings.temperature}</span>
                </label>
                <input
                  type="range"
                  min="0" max="2" step="0.1"
                  value={settings.temperature}
                  onChange={e => setSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Точный</span>
                  <span>Креативный</span>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <label className="block text-sm text-secondary-foreground mb-2">Максимум токенов</label>
                <input
                  type="number"
                  min={100} max={4000}
                  value={settings.max_tokens}
                  onChange={e => setSettings(s => ({ ...s, max_tokens: parseInt(e.target.value) || 600 }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-[#141821] text-white placeholder:text-gray-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:border-gray-600 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1.5">Ограничивает длину ответа бота</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-5">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Check size={16} />
              )}
              {saving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
            {message && (
              <span className={`text-sm font-medium ${message.includes('Ошибка') || message.includes('не добавлена') ? 'text-red-600' : 'text-green-600'}`}>
                {message}
              </span>
            )}
          </div>

          {/* Test section */}
          <div className="mt-6 pt-5 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-secondary-foreground">Тестирование модели</h3>
              <div className="flex items-center gap-2">
                {chatMessages.length > 0 && (
                  <button
                    onClick={() => setChatMessages([])}
                    className="text-xs text-muted-foreground hover:text-secondary-foreground transition-colors"
                  >
                    Очистить чат
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!settings.vision_model || testing !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-colors border border-green-200"
                >
                  {testing === 'vision' ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  Тест фото
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleTestVision(file)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>

            {/* Chat messages */}
            <div className="border border-border rounded-xl bg-muted mb-3">
              <div className="h-64 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    <div className="text-center">
                      <MessageSquare size={24} className="mx-auto mb-2 text-muted-foreground/50" />
                      <p>Напишите сообщение для теста текстовой модели</p>
                      {settings.text_model && (
                        <p className="text-xs text-muted-foreground/50 mt-1">Модель: {settings.text_model}</p>
                      )}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${msg.role === 'user' ? '' : ''}`}>
                      {msg.role === 'assistant' && msg.model && (
                        <div className="text-[10px] text-muted-foreground mb-1 ml-1">{msg.model}</div>
                      )}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-card text-foreground border border-border rounded-bl-md shadow-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                {testing && (
                  <div className="flex justify-start">
                    <div className="bg-card text-muted-foreground border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div className="border-t border-border p-3 bg-card rounded-b-xl">
                <form
                  onSubmit={e => { e.preventDefault(); handleSendChat() }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder={settings.text_model ? `Сообщение для ${settings.text_model}...` : 'Сначала назначьте текстовую модель'}
                    disabled={!settings.text_model || testing === 'text'}
                    className="flex-1 px-3.5 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-[#141821] text-white placeholder:text-gray-500 disabled:bg-muted disabled:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || !settings.text_model || testing === 'text'}
                    className="flex items-center justify-center w-9 h-9 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>

            {testError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {testError}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab: Usage */}
      {activeTab === 'usage' && (
        <section className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Статистика затрат</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Расход токенов и стоимость по моделям</p>
            </div>
            <select
              value={usagePeriod}
              onChange={e => setUsagePeriod(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white"
            >
              <option value="today">Сегодня</option>
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
              <option value="all">Всё время</option>
            </select>
          </div>

          {/* OpenAI Real Costs from API */}
          {providers.some(p => p.provider === 'openai') && (
            <div className="mb-5 p-4 bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-xl border border-green-700/30">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-green-400 uppercase tracking-wide font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Реальные затраты OpenAI ({usagePeriod === 'today' ? 'сегодня' : usagePeriod === 'week' ? 'неделя' : usagePeriod === 'month' ? 'месяц' : 'всё время'})
                </div>
                {loadingOpenai && <Loader2 size={14} className="animate-spin text-green-400" />}
              </div>
              {openaiUsage?.error ? (
                <p className="text-sm text-yellow-400">{openaiUsage.error}</p>
              ) : openaiUsage?.costs?.error ? (
                <p className="text-sm text-yellow-400">{openaiUsage.costs.error}</p>
              ) : openaiUsage?.costs?.data && Array.isArray(openaiUsage.costs.data) && openaiUsage.costs.data.length > 0 ? (
                <div className="text-2xl font-bold text-green-400">
                  ${(() => {
                    try {
                      let total = 0
                      for (const bucket of openaiUsage.costs.data) {
                        if (bucket.results && Array.isArray(bucket.results)) {
                          for (const result of bucket.results) {
                            if (result.amount && result.amount.value) {
                              const val = parseFloat(String(result.amount.value))
                              if (!isNaN(val)) {
                                total += val
                              }
                            }
                          }
                        }
                      }
                      return total.toFixed(4)
                    } catch (e) {
                      console.error('Error calculating costs:', e)
                      return '0.0000'
                    }
                  })()}
                </div>
              ) : openaiUsage?.costs?.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет данных за этот период</p>
              ) : !loadingOpenai && openaiUsage ? (
                <p className="text-sm text-yellow-400">API не вернул данные о расходах</p>
              ) : (
                <p className="text-sm text-muted-foreground">Загрузка...</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Данные напрямую из OpenAI Usage API</p>
            </div>
          )}

          {totalCost > 0 && (
            <div className="mb-5 p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-700/30">
              <div className="text-xs text-blue-400 uppercase tracking-wide font-medium">Расчётные затраты (локальный учёт)</div>
              <div className="text-2xl font-bold text-foreground mt-1">${Number(totalCost).toFixed(4)}</div>
            </div>
          )}

          {usageStats.length === 0 ? (
            <div className="text-center py-10 bg-muted rounded-lg border border-dashed border-border">
              <BarChart3 size={32} className="mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">Нет данных за выбранный период</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-secondary-foreground">Провайдер</th>
                    <th className="text-left py-3 px-4 font-medium text-secondary-foreground">Модель</th>
                    <th className="text-left py-3 px-4 font-medium text-secondary-foreground">Тип</th>
                    <th className="text-right py-3 px-4 font-medium text-secondary-foreground">Запросов</th>
                    <th className="text-right py-3 px-4 font-medium text-secondary-foreground">Токены</th>
                    <th className="text-right py-3 px-4 font-medium text-secondary-foreground">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {usageStats.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted transition-colors">
                      <td className="py-3 px-4 text-foreground font-medium">{PROVIDER_LABELS[row.provider as ProviderType] || row.provider}</td>
                      <td className="py-3 px-4 text-secondary-foreground font-mono text-xs">{row.model}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{row.task_type}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-foreground font-medium">{row.requests_count}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground text-xs font-mono">
                        {row.total_input_tokens.toLocaleString()} / {row.total_output_tokens.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground font-semibold">
                        ${Number(row.total_cost_usd).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Modals */}
      {showAddProviderModal && (
        <AddProviderModal
          onClose={() => setShowAddProviderModal(false)}
          onAdded={handleProviderAdded}
          existingProviders={providers.map(p => p.provider)}
        />
      )}
      {showAddModelsModal && (
        <AddModelsModal
          onClose={() => setShowAddModelsModal(false)}
          onAdded={handleModelsAdded}
          providers={providers}
          existingModels={addedModels}
        />
      )}
      {editingAdminKey && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditingAdminKey(null)}>
          <div className="bg-card rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Admin API Key для OpenAI</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Для получения данных о затратах из OpenAI Usage API требуется Admin API key.
              Создайте его в <a href="https://platform.openai.com/settings/organization/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">настройках OpenAI</a> с правами на чтение Usage.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">Admin API Key</label>
                <input
                  type="password"
                  value={adminKeyValue}
                  onChange={e => setAdminKeyValue(e.target.value)}
                  placeholder="sk-admin-..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editingAdminKey.has_admin_key ? 'Ключ уже настроен. Введите новый для замены.' : 'Ключ ещё не настроен.'}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingAdminKey(null)}
                  className="px-4 py-2 text-secondary-foreground hover:text-foreground"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveAdminKey}
                  disabled={savingAdminKey || !adminKeyValue.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingAdminKey ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
