import { useEffect, useState } from 'react'
import { settingsApi } from '../../api/settings'
import type { BotPersona } from '../../types'

export default function PersonaSettings() {
  const [personas, setPersonas] = useState<BotPersona[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [data, setData] = useState<Partial<BotPersona>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPersonas()
  }, [])

  const loadPersonas = () => {
    settingsApi.getPersonas()
      .then(({ data }) => {
        setPersonas(data)
        const def = data.find((p) => p.is_default) || data[0]
        if (def) {
          setSelectedId(def.id)
          setData(def)
        }
      })
      .finally(() => setLoading(false))
  }

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
      const { data: created } = await settingsApi.createPersona({ name: 'Новая персона' })
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
    setPersonas((prev) => prev.map((p) => ({ ...p, is_default: p.id === selectedId })))
  }

  if (loading) return <div className="text-muted-foreground">Загрузка...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Персона бота</h1>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          + Новая
        </button>
      </div>

      {personas.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPersona(p.id)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                p.id === selectedId
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-border text-secondary-foreground hover:bg-muted'
              }`}
            >
              {p.name}{p.is_default ? ' (по умолч.)' : ''}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-foreground mb-1">Имя</label>
            <input
              type="text"
              value={data.name || ''}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="Фёдор"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500"
            />
          </div>
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
        </div>

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
          <p className="text-xs text-muted-foreground mt-1">Промпт для генерации ответа по фото еды. Получает JSON с анализом и дневной сводкой. Если пусто — используется шаблонный ответ.</p>
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

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {selectedId && personas.find((p) => p.id === selectedId && !p.is_default) && (
            <button
              type="button"
              onClick={handleSetDefault}
              className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Сделать по умолчанию
            </button>
          )}
          {selectedId && personas.length > 1 && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 text-sm text-red-500 hover:text-red-700"
            >
              Удалить
            </button>
          )}
          {message && (
            <span className={`text-sm ${message.includes('Ошибка') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
