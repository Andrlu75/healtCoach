import { useEffect, useState } from 'react'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import api from '../../api/client'

export default function AccountSettings() {
  const { user, coach, loadProfile, isLoading } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) {
      loadProfile()
    }
  }, [user, loadProfile])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!currentPassword || !newPassword) {
      setMessage('Заполните все поля')
      return
    }

    if (newPassword.length < 6) {
      setMessage('Новый пароль должен содержать минимум 6 символов')
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage('Пароли не совпадают')
      return
    }

    setSaving(true)
    try {
      await api.post('/coach/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setMessage('Пароль успешно изменён')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setMessage(error.response?.data?.error || 'Ошибка при смене пароля')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Настройки аккаунта</h1>

      {/* Account info */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <User size={20} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-foreground">Информация об аккаунте</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Имя пользователя
            </label>
            <div className="px-3 py-2 bg-muted rounded-lg text-foreground">
              {user?.username || '—'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Email
            </label>
            <div className="px-3 py-2 bg-muted rounded-lg text-foreground">
              {user?.email || '—'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Имя
            </label>
            <div className="px-3 py-2 bg-muted rounded-lg text-foreground">
              {user?.first_name || '—'} {user?.last_name || ''}
            </div>
          </div>

          {coach?.business_name && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Название бизнеса
              </label>
              <div className="px-3 py-2 bg-muted rounded-lg text-foreground">
                {coach.business_name}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock size={20} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-foreground">Смена пароля</h2>
        </div>

        {message && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg text-sm ${
              message.includes('успешно')
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-foreground mb-1">
              Текущий пароль
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500"
                placeholder="Введите текущий пароль"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-foreground mb-1">
              Новый пароль
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500"
                placeholder="Минимум 6 символов"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-foreground mb-1">
              Подтвердите новый пароль
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#141821] text-white placeholder:text-gray-500"
              placeholder="Повторите новый пароль"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сменить пароль'}
          </button>
        </form>
      </div>
    </div>
  )
}
