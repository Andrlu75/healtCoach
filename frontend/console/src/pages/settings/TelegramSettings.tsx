import { useEffect, useState } from 'react'
import { Send, Plus, Trash2, Bot } from 'lucide-react'
import { settingsApi } from '../../api/settings'
import type { TelegramBot } from '../../types'

export default function TelegramSettings() {
  const [bots, setBots] = useState<TelegramBot[]>([])
  const [notificationChatId, setNotificationChatId] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // Add bot form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newToken, setNewToken] = useState('')
  const [adding, setAdding] = useState(false)

  // Notification chat id save
  const [savingChat, setSavingChat] = useState(false)

  // Test
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    settingsApi.getTelegramSettings()
      .then(({ data }) => {
        setBots(data.bots)
        setNotificationChatId(data.notification_chat_id)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleAddBot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newToken.trim()) return
    setAdding(true)
    setMessage('')
    try {
      const { data } = await settingsApi.addTelegramBot(newName.trim(), newToken.trim())
      setBots(prev => [...prev, data])
      setNewName('')
      setNewToken('')
      setShowAddForm(false)
      setMessage('Бот добавлен')
    } catch {
      setMessage('Ошибка добавления бота')
    } finally {
      setAdding(false)
    }
  }

  const handleSwitch = async (botId: number) => {
    try {
      await settingsApi.switchTelegramBot(botId)
      setBots(prev => prev.map(b => ({ ...b, is_active: b.id === botId })))
    } catch {
      setMessage('Ошибка переключения')
    }
  }

  const handleDelete = async (botId: number) => {
    if (!confirm('Удалить бота?')) return
    try {
      await settingsApi.deleteTelegramBot(botId)
      setBots(prev => {
        const remaining = prev.filter(b => b.id !== botId)
        const deleted = prev.find(b => b.id === botId)
        // If deleted was active, first remaining becomes active
        if (deleted?.is_active && remaining.length > 0) {
          remaining[0] = { ...remaining[0], is_active: true }
        }
        return remaining
      })
      setMessage('Бот удалён')
    } catch {
      setMessage('Ошибка удаления')
    }
  }

  const handleSaveChatId = async () => {
    setSavingChat(true)
    setMessage('')
    try {
      await settingsApi.updateNotificationChatId(notificationChatId)
      setMessage('Chat ID сохранён')
    } catch {
      setMessage('Ошибка сохранения')
    } finally {
      setSavingChat(false)
    }
  }

  const handleTest = async () => {
    const chatId = notificationChatId?.trim()
    if (!chatId) {
      setTestMessage('Заполните Chat ID')
      return
    }
    const activeBot = bots.find(b => b.is_active)
    if (!activeBot) {
      setTestMessage('Нет активного бота')
      return
    }
    setTesting(true)
    setTestMessage('')
    try {
      await settingsApi.testTelegram(chatId)
      setTestMessage('Сообщение отправлено!')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string }
      setTestMessage(error.response?.data?.error || error.message || 'Ошибка отправки')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Настройки Telegram</h1>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${message.includes('Ошибка') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Bot list */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Боты</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            Добавить
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddBot} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Тестовый"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Токен</label>
              <input
                type="password"
                value={newToken}
                onChange={e => setNewToken(e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Получите у @BotFather в Telegram</p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {adding ? 'Добавление...' : 'Добавить бота'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        )}

        {bots.length === 0 ? (
          <p className="text-sm text-gray-500">Нет добавленных ботов. Нажмите «Добавить» чтобы создать первого.</p>
        ) : (
          <div className="space-y-3">
            {bots.map(bot => (
              <div
                key={bot.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${bot.is_active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center gap-3">
                  <Bot size={20} className={bot.is_active ? 'text-blue-600' : 'text-gray-400'} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{bot.name}</span>
                      {bot.is_active && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Активный</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{bot.masked_token}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!bot.is_active && (
                    <button
                      onClick={() => handleSwitch(bot.id)}
                      className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      Активировать
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(bot.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notification Chat ID */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Уведомления</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chat ID для уведомлений</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={notificationChatId}
              onChange={e => setNotificationChatId(e.target.value)}
              placeholder="-1001234567890"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={handleSaveChatId}
              disabled={savingChat}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {savingChat ? '...' : 'Сохранить'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">ID чата для получения отчётов и уведомлений (общий для всех ботов)</p>
        </div>
      </div>

      {/* Test connection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Тест соединения</h2>
        <p className="text-sm text-gray-500 mb-4">
          Отправьте тестовое сообщение через активного бота в указанный чат.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
            {testing ? 'Отправка...' : 'Отправить тест'}
          </button>
          {testMessage && (
            <span className={`text-sm ${testMessage.includes('Ошибка') || testMessage.includes('Нет') || testMessage.includes('Заполните') ? 'text-red-600' : 'text-green-600'}`}>
              {testMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
