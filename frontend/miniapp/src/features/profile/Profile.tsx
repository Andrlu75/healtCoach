import { motion } from 'framer-motion'
import { User, Target, Moon, Sun, LogOut } from 'lucide-react'
import { useAuthStore } from '../auth'
import { useThemeStore } from '../../shared/stores/theme'
import { useTelegram, useHaptic } from '../../shared/hooks'
import { Card } from '../../shared/components/ui'

function Profile() {
  const client = useAuthStore((s) => s.client)
  const logout = useAuthStore((s) => s.logout)
  const { theme, setTheme } = useThemeStore()
  const { showConfirm, close } = useTelegram()
  const { impact, notification } = useHaptic()

  const handleThemeToggle = () => {
    impact('light')
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const handleLogout = async () => {
    const confirmed = await showConfirm('Вы уверены, что хотите выйти?')
    if (confirmed) {
      notification('success')
      logout()
      close()
    }
  }

  const goals = [
    { label: 'Калории', value: client?.daily_calories, unit: 'ккал' },
    { label: 'Белки', value: client?.daily_proteins, unit: 'г' },
    { label: 'Жиры', value: client?.daily_fats, unit: 'г' },
    { label: 'Углеводы', value: client?.daily_carbs, unit: 'г' },
    { label: 'Вода', value: client?.daily_water, unit: 'л' },
  ].filter((g) => g.value != null)

  return (
    <div className="p-4 space-y-4">
      <Card variant="elevated" className="p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <User size={32} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {client?.first_name} {client?.last_name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Клиент
            </p>
          </div>
        </div>
      </Card>

      {goals.length > 0 && (
        <Card variant="elevated" className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={18} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Дневные цели
            </h3>
          </div>
          <div className="space-y-2">
            {goals.map(({ label, value, unit }) => (
              <div key={label} className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {label}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {value} {unit}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card variant="elevated" className="overflow-hidden">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleThemeToggle}
          className="w-full p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            {theme === 'light' ? (
              <Sun size={20} className="text-amber-500" />
            ) : (
              <Moon size={20} className="text-blue-400" />
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Тема
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {theme === 'light' ? 'Светлая' : 'Тёмная'}
          </span>
        </motion.button>
      </Card>

      <Card variant="elevated" className="overflow-hidden">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full p-4 flex items-center gap-3 text-red-600"
        >
          <LogOut size={20} />
          <span className="text-sm font-medium">Выйти</span>
        </motion.button>
      </Card>
    </div>
  )
}

export default Profile
