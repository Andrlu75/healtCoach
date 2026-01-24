import { useEffect, useState } from 'react'
import { settingsApi } from '../../api/settings'
import type { BotPersona } from '../../types'

export default function PersonaSettings() {
  const [data, setData] = useState<Partial<BotPersona>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    settingsApi.getPersona()
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await settingsApi.updatePersona(data)
      setMessage('Персона сохранена')
    } catch {
      setMessage('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Персона бота</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
            <input
              type="text"
              value={data.name || ''}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="Фёдор"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Возраст</label>
            <input
              type="number"
              value={data.age ?? ''}
              onChange={(e) => setData({ ...data, age: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
            <input
              type="text"
              value={data.city || ''}
              onChange={(e) => setData({ ...data, city: e.target.value })}
              placeholder="Москва"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Стиль общения</label>
          <textarea
            value={data.style_description || ''}
            onChange={(e) => setData({ ...data, style_description: e.target.value })}
            rows={3}
            placeholder="Дружелюбный, с юмором, поддерживающий..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Системный промпт</label>
          <textarea
            value={data.system_prompt || ''}
            onChange={(e) => setData({ ...data, system_prompt: e.target.value })}
            rows={6}
            placeholder="Ты — дружелюбный помощник health-коуча..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Основная инструкция для AI-модели</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Приветственное сообщение</label>
          <textarea
            value={data.greeting_message || ''}
            onChange={(e) => setData({ ...data, greeting_message: e.target.value })}
            rows={3}
            placeholder="Привет! Я Фёдор, твой помощник по здоровому питанию..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">Отправляется новому клиенту после онбординга</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
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
