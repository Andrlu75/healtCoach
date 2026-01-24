import { useEffect, useState } from 'react'
import { settingsApi } from '../../api/settings'
import type { TelegramSettings as TelegramSettingsType } from '../../types'

const defaultData: TelegramSettingsType = {
  bot_token: '',
  webhook_url: '',
  notification_chat_id: '',
}

export default function TelegramSettings() {
  const [data, setData] = useState<TelegramSettingsType>(defaultData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    settingsApi.getTelegramSettings()
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await settingsApi.updateTelegramSettings(data)
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Настройки Telegram</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bot Token</label>
          <input
            type="password"
            value={data.bot_token}
            onChange={(e) => setData({ ...data, bot_token: e.target.value })}
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">Получите у @BotFather в Telegram</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
          <input
            type="url"
            value={data.webhook_url}
            onChange={(e) => setData({ ...data, webhook_url: e.target.value })}
            placeholder="https://your-domain.com/api/bot/webhook/"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">URL для получения обновлений от Telegram</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chat ID для уведомлений</label>
          <input
            type="text"
            value={data.notification_chat_id}
            onChange={(e) => setData({ ...data, notification_chat_id: e.target.value })}
            placeholder="-1001234567890"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">ID чата для получения отчётов и уведомлений</p>
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
