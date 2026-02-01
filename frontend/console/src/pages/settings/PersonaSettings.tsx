import { useEffect, useState } from 'react'
import { settingsApi } from '../../api/settings'
import type { BotPersona } from '../../types'

type TabType = 'main' | 'controller'

export default function PersonaSettings() {
  const [personas, setPersonas] = useState<BotPersona[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [data, setData] = useState<Partial<BotPersona>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('main')

  useEffect(() => {
    loadPersonas()
  }, [])

  const loadPersonas = () => {
    settingsApi.getPersonas()
      .then(({ data }) => {
        setPersonas(data)
        // Выбираем первую персону текущей вкладки
        const filtered = data.filter((p) => (p.role || 'main') === activeTab)
        const def = filtered.find((p) => p.is_default) || filtered[0]
        if (def) {
          setSelectedId(def.id)
          setData(def)
        } else {
          setSelectedId(null)
          setData({})
        }
      })
      .finally(() => setLoading(false))
  }

  // При смене вкладки выбираем первую персону
  useEffect(() => {
    const filtered = personas.filter((p) => (p.role || 'main') === activeTab)
    const def = filtered.find((p) => p.is_default) || filtered[0]
    if (def) {
      setSelectedId(def.id)
      setData(def)
    } else {
      setSelectedId(null)
      setData({})
    }
    setMessage('')
  }, [activeTab, personas])

  const filteredPersonas = personas.filter((p) => (p.role || 'main') === activeTab)
  const controllers = personas.filter((p) => p.role === 'controller')

  const selectPersona = (id: number) => {
    const p = personas.find((x) => x.id === id)
    if (p) {
      setSelectedId(id)
      setData(p)
      setMessage('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    setSaving(true)
    setMessage('')
    try {
      const { data: updated } = await settingsApi.updatePersona({ ...data, id: selectedId })
      setPersonas((prev) => prev.map((p) => (p.id === selectedId ? updated : p)))
      setData(updated)
      setMessage('Персона сохранена')
    } catch {
      setMessage('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const newName = activeTab === 'controller' ? 'Новый контролёр' : 'Новая персона'
      const { data: created } = await settingsApi.createPersona({ name: newName, role: activeTab })
      setPersonas((prev) => [...prev, created])
      setSelectedId(created.id)
      setData(created)
      setMessage('')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId || !confirm('Удалить персону?')) return
    await settingsApi.deletePersona(selectedId)
    loadPersonas()
  }

  const handleSetDefault = async () => {
    if (!selectedId) return
    await settingsApi.setPersonaDefault(selectedId)
    setPersonas((prev) => prev.map((p) => ({ ...p, is_default: p.id === selectedId && p.role === activeTab ? true : (p.role === activeTab ? false : p.is_default) })))
  }

  if (loading) return <div className="text-muted-foreground">Загрузка...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Персоны</h1>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          + {activeTab === 'controller' ? 'Контролёр' : 'Персона'}
        </button>
      </div>

      {/* Вкладки: Основные / Контролёры */}
      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          onClick={() => setActiveTab('main')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'main'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-secondary-foreground hover:text-foreground'
          }`}
        >
          Основные персоны
        </button>
        <button
          onClick={() => setActiveTab('controller')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'controller'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-secondary-foreground hover:text-foreground'
          }`}
        >
          Контролёры программы
        </button>
      </div>

      {/* Список персон текущей вкладки */}
      {filteredPersonas.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {filteredPersonas.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPersona(p.id)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                p.id === selectedId
                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                  : 'border-border text-secondary-foreground hover:bg-muted'
              }`}
            >
              {p.name}{p.is_default ? ' (по умолч.)' : ''}
            </button>
          ))}
        </div>
      )}

      {filteredPersonas.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {activeTab === 'controller'
            ? 'Нет контролёров. Создайте первого контролёра программы питания.'
            : 'Нет персон. Создайте первую персону бота.'}
        </div>
      )}

      {selectedId && (
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
          {/* Общие поля для обоих типов */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={activeTab === 'controller' ? 'sm:col-span-3' : ''}>
              <label className="block text-sm font-medium text-secondary-foreground mb-1">Имя</label>
              <input
                type="text"
                value={data.name || ''}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder={activeTab === 'controller' ? 'Шеф-Контролёр' : 'Фёдор'}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500"
              />
            </div>
            {activeTab === 'main' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">Возраст</label>
                  <input
                    type="number"
                    value={data.age ?? ''}
                    onChange={(e) => setData({ ...data, age: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">Город</label>
                  <input
                    type="text"
                    value={data.city || ''}
                    onChange={(e) => setData({ ...data, city: e.target.value })}
                    placeholder="Москва"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500"
                  />
                </div>
              </>
            )}
          </div>

          {/* Поля только для основной персоны */}
          {activeTab === 'main' && (
            <>
              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">Стиль общения</label>
                <textarea
                  value={data.style_description || ''}
                  onChange={(e) => setData({ ...data, style_description: e.target.value })}
                  rows={3}
                  placeholder="Дружелюбный, с юмором, поддерживающий..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-[#141821] text-white placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">Системный промпт</label>
                <textarea
                  value={data.system_prompt || ''}
                  onChange={(e) => setData({ ...data, system_prompt: e.target.value })}
                  rows={6}
                  placeholder="Ты — дружелюбный помощник health-коуча..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm bg-[#141821] text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-muted-foreground mt-1">Основная инструкция для AI-модели</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">Промпт ответа по еде</label>
                <textarea
                  value={data.food_response_prompt || ''}
                  onChange={(e) => setData({ ...data, food_response_prompt: e.target.value })}
                  rows={5}
                  placeholder="Ты — нутрициолог. Получив данные анализа еды и дневную сводку, дай развёрнутый ответ..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm bg-[#141821] text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-muted-foreground mt-1">Промпт для генерации ответа по фото еды</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">Приветственное сообщение</label>
                <textarea
                  value={data.greeting_message || ''}
                  onChange={(e) => setData({ ...data, greeting_message: e.target.value })}
                  rows={3}
                  placeholder="Привет! Я Фёдор, твой помощник по здоровому питанию..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-[#141821] text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-muted-foreground mt-1">Отправляется новому клиенту после онбординга</p>
              </div>

              {/* Выбор контролёра для основной персоны */}
              {controllers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-secondary-foreground mb-1">Контролёр программы питания</label>
                  <select
                    value={data.controller || ''}
                    onChange={(e) => setData({ ...data, controller: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white"
                  >
                    <option value="">Без контролёра</option>
                    {controllers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Контролёр сравнивает план и факт при фото-отчётах по программе питания</p>
                </div>
              )}
            </>
          )}

          {/* Поля только для контролёра */}
          {activeTab === 'controller' && (
            <>
              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">Стиль и характер</label>
                <textarea
                  value={data.style_description || ''}
                  onChange={(e) => setData({ ...data, style_description: e.target.value })}
                  rows={2}
                  placeholder="Строгий но справедливый, с лёгкой иронией..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-[#141821] text-white placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">Системный промпт</label>
                <textarea
                  value={data.system_prompt || ''}
                  onChange={(e) => setData({ ...data, system_prompt: e.target.value })}
                  rows={4}
                  placeholder="Ты — персональный диетолог-консультант. Общайся дружелюбно, поддерживай клиента в соблюдении программы питания..."
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm bg-[#141821] text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-muted-foreground mt-1">Основная инструкция для AI — определяет характер и стиль общения</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">Промпт программы питания</label>
                <textarea
                  value={data.nutrition_program_prompt || ''}
                  onChange={(e) => setData({ ...data, nutrition_program_prompt: e.target.value })}
                  rows={12}
                  placeholder={`Ты — дружелюбный диетолог-консультант с чувством юмора.

КОНТЕКСТ:
{program_info}
{program_history}

ТЕКУЩИЙ ПРИЁМ ПИЩИ:
📋 По плану: {planned_meal}
📸 По факту: {actual_meal}

СЛЕДУЮЩИЙ ПРИЁМ ПИЩИ:
{next_meal}

ИНСТРУКЦИЯ:
1. Начни с контекста дня и ободряющей фразы
2. Сравни план и факт:
   - Совпадает → похвали
   - Есть отклонения → отметь мягко, НО не говори что альтернатива тоже хороша. План важен!
3. Напомни что на следующий приём пищи
4. Заверши мотивирующей фразой о важности программы

СТИЛЬ: Дружелюбный, с юмором, но чёткий акцент на плане. 3-5 предложений.`}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm bg-[#141821] text-white placeholder:text-gray-500"
                />
                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">
                    <strong>Контролёр программы питания</strong> — AI-персона которая сравнивает план и факт. Можете сделать его юмористом, строгим тренером или заботливой бабушкой.
                  </p>
                  <p className="text-xs text-muted-foreground mb-1">Переменные:</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                    <li><code className="text-blue-400">{'{program_info}'}</code> — программа и день (напр. "День 5 из 14")</li>
                    <li><code className="text-blue-400">{'{program_history}'}</code> — статистика выполнения за все дни</li>
                    <li><code className="text-blue-400">{'{planned_meal}'}</code> — что должен был съесть клиент (текущий приём)</li>
                    <li><code className="text-blue-400">{'{actual_meal}'}</code> — что съел на самом деле</li>
                    <li><code className="text-blue-400">{'{next_meal}'}</code> — следующий приём пищи по программе</li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-foreground mb-1">Промпт для списка покупок</label>
                <textarea
                  value={data.shopping_list_prompt || ''}
                  onChange={(e) => setData({ ...data, shopping_list_prompt: e.target.value })}
                  rows={8}
                  placeholder={`Проанализируй меню на день и составь список продуктов для покупки.

Меню:
{meals_description}

Выведи список в формате JSON массива:
[
  {"name": "Куриная грудка", "category": "meat"},
  {"name": "Помидоры", "category": "vegetables"}
]

Категории: vegetables, meat, dairy, grains, other.
Правила: объединяй похожие, каждый с заглавной, без количества.
Выведи ТОЛЬКО JSON массив.`}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm bg-[#141821] text-white placeholder:text-gray-500"
                />
                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Переменные:</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                    <li><code className="text-blue-400">{'{meals_description}'}</code> — описание блюд на день</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">Если не задан — используется стандартный промпт.</p>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              {selectedId && filteredPersonas.find((p) => p.id === selectedId && !p.is_default) && (
                <button
                  type="button"
                  onClick={handleSetDefault}
                  className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  По умолч.
                </button>
              )}
              {selectedId && filteredPersonas.length > 1 && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-2 text-sm text-red-500 hover:text-red-700"
                >
                  Удалить
                </button>
              )}
            </div>
            {message && (
              <span className={`text-sm ${message.includes('Ошибка') ? 'text-red-600' : 'text-green-600'}`}>
                {message}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
