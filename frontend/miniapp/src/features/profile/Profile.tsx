import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Target, Moon, Sun, LogOut, Check, Zap, Sparkles, HelpCircle } from 'lucide-react'
import { useAuthStore } from '../auth'
import { useThemeStore } from '../../shared/stores/theme'
import { useTelegram, useHaptic } from '../../shared/hooks'
import { Card } from '../../shared/components/ui'
import { updateProfile } from '../../api/endpoints'
import { GoogleFitConnect, HuaweiHealthConnect } from '../integrations'

type MealAnalysisMode = 'ask' | 'fast' | 'smart'

function Profile() {
  const client = useAuthStore((s) => s.client)
  const setClient = useAuthStore((s) => s.setClient)
  const logout = useAuthStore((s) => s.logout)
  const { theme, setTheme } = useThemeStore()
  const { showConfirm, close } = useTelegram()
  const { impact, notification } = useHaptic()
  const [savingGender, setSavingGender] = useState(false)
  const [savingMode, setSavingMode] = useState(false)

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

  const handleGenderChange = async (gender: 'male' | 'female') => {
    if (savingGender || client?.gender === gender) return
    impact('light')
    setSavingGender(true)
    try {
      const response = await updateProfile({ gender })
      if (client) {
        setClient({ ...client, gender: response.data.gender })
      }
      notification('success')
    } catch (error) {
      console.error('Error updating gender:', error)
      notification('error')
    } finally {
      setSavingGender(false)
    }
  }

  const handleModeChange = async (mode: MealAnalysisMode) => {
    if (savingMode || client?.meal_analysis_mode === mode) return
    impact('light')
    setSavingMode(true)
    try {
      const response = await updateProfile({ meal_analysis_mode: mode })
      if (client) {
        setClient({ ...client, meal_analysis_mode: response.data.meal_analysis_mode })
      }
      notification('success')
    } catch (error) {
      console.error('Error updating meal analysis mode:', error)
      notification('error')
    } finally {
      setSavingMode(false)
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

      {/* Gender selector */}
      <Card variant="elevated" className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Пол
        </h3>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleGenderChange('male')}
            disabled={savingGender}
            className={`flex-1 p-3 rounded-xl border-2 transition-colors ${
              client?.gender === 'male'
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">👨</span>
              <span className={`text-sm font-medium ${
                client?.gender === 'male'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                Мужской
              </span>
              {client?.gender === 'male' && (
                <Check size={16} className="text-blue-600" />
              )}
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleGenderChange('female')}
            disabled={savingGender}
            className={`flex-1 p-3 rounded-xl border-2 transition-colors ${
              client?.gender === 'female'
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">👩</span>
              <span className={`text-sm font-medium ${
                client?.gender === 'female'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                Женский
              </span>
              {client?.gender === 'female' && (
                <Check size={16} className="text-blue-600" />
              )}
            </div>
          </motion.button>
        </div>
      </Card>

      {/* Meal analysis mode */}
      <Card variant="elevated" className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Режим анализа еды
        </h3>
        <div className="space-y-2">
          {/* Ask */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleModeChange('ask')}
            disabled={savingMode}
            className={`w-full p-3 rounded-xl border-2 transition-colors text-left ${
              client?.meal_analysis_mode === 'ask'
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                client?.meal_analysis_mode === 'ask'
                  ? 'bg-blue-100 dark:bg-blue-900/50'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <HelpCircle size={20} className={
                  client?.meal_analysis_mode === 'ask' ? 'text-blue-600' : 'text-gray-500'
                } />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    client?.meal_analysis_mode === 'ask'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    Спрашивать каждый раз
                  </span>
                  {client?.meal_analysis_mode === 'ask' && (
                    <Check size={16} className="text-blue-600" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Выбирать режим при каждом добавлении
                </p>
              </div>
            </div>
          </motion.button>

          {/* Fast */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleModeChange('fast')}
            disabled={savingMode}
            className={`w-full p-3 rounded-xl border-2 transition-colors text-left ${
              client?.meal_analysis_mode === 'fast'
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                client?.meal_analysis_mode === 'fast'
                  ? 'bg-blue-100 dark:bg-blue-900/50'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <Zap size={20} className={
                  client?.meal_analysis_mode === 'fast' ? 'text-blue-600' : 'text-gray-500'
                } />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    client?.meal_analysis_mode === 'fast'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    Быстрый режим
                  </span>
                  {client?.meal_analysis_mode === 'fast' && (
                    <Check size={16} className="text-blue-600" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Распознавание и сохранение сразу
                </p>
              </div>
            </div>
          </motion.button>

          {/* Smart */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleModeChange('smart')}
            disabled={savingMode}
            className={`w-full p-3 rounded-xl border-2 transition-colors text-left ${
              client?.meal_analysis_mode === 'smart'
                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                client?.meal_analysis_mode === 'smart'
                  ? 'bg-purple-100 dark:bg-purple-900/50'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <Sparkles size={20} className={
                  client?.meal_analysis_mode === 'smart' ? 'text-purple-600' : 'text-gray-500'
                } />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    client?.meal_analysis_mode === 'smart'
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    Умный режим
                  </span>
                  {client?.meal_analysis_mode === 'smart' && (
                    <Check size={16} className="text-purple-600" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Детальный анализ с редактированием ингредиентов
                </p>
              </div>
            </div>
          </motion.button>
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

      {/* Integrations */}
      <Card variant="elevated" className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Интеграции
        </h3>
        <div className="space-y-3">
          <GoogleFitConnect />
          <HuaweiHealthConnect />
        </div>
      </Card>

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
