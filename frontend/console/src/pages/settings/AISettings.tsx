import { useEffect, useState } from 'react'
import { settingsApi } from '../../api/settings'
import type { AISettings as AISettingsType } from '../../types'

const defaultData: AISettingsType = {
  ai_provider: 'openai',
  ai_model_chat: 'gpt-4o',
  ai_model_vision: 'gpt-4o',
  temperature: 0.7,
  max_tokens: 1000,
  openai_api_key: '',
  anthropic_api_key: '',
}

export default function AISettings() {
  const [data, setData] = useState<AISettingsType>(defaultData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    settingsApi.getAISettings()
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await settingsApi.updateAISettings(data)
      setMessage('Настройки сохранены')
    } catch {
      setMessage('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">AI настройки</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Провайдер</label>
          <select
            value={data.ai_provider}
            onChange={(e) => setData({ ...data, ai_provider: e.target.value as 'openai' | 'anthropic' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Модель (чат)</label>
            <input
              type="text"
              value={data.ai_model_chat}
              onChange={(e) => setData({ ...data, ai_model_chat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Модель (vision)</label>
            <input
              type="text"
              value={data.ai_model_vision}
              onChange={(e) => setData({ ...data, ai_model_vision: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature ({data.temperature})
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={data.temperature}
              onChange={(e) => setData({ ...data, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max tokens</label>
            <input
              type="number"
              min={100}
              max={4000}
              value={data.max_tokens}
              onChange={(e) => setData({ ...data, max_tokens: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
          <input
            type="password"
            value={data.openai_api_key}
            onChange={(e) => setData({ ...data, openai_api_key: e.target.value })}
            placeholder="sk-..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Key</label>
          <input
            type="password"
            value={data.anthropic_api_key}
            onChange={(e) => setData({ ...data, anthropic_api_key: e.target.value })}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
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
