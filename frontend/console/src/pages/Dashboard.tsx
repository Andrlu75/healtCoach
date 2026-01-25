import { useEffect, useState } from 'react'
import { Users, UserCheck, UserPlus, UserX, DollarSign, User } from 'lucide-react'
import { settingsApi } from '../api/settings'
import type { DashboardStats, AIUsageResponse } from '../types'

const statCards = [
  { key: 'total_clients', label: 'Всего клиентов', icon: Users, color: 'blue' },
  { key: 'active_clients', label: 'Активные', icon: UserCheck, color: 'green' },
  { key: 'pending_clients', label: 'Ожидают', icon: UserPlus, color: 'yellow' },
  { key: 'paused_clients', label: 'На паузе', icon: UserX, color: 'gray' },
] as const

const colorMap = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  gray: 'bg-gray-100 text-gray-700',
}

const periodLabels: Record<string, string> = {
  today: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [usage, setUsage] = useState<AIUsageResponse | null>(null)
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    settingsApi.getDashboardStats()
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    settingsApi.getUsageStats(period)
      .then(({ data }) => setUsage(data))
  }, [period])

  if (loading) {
    return <div className="text-gray-500">Загрузка...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Дашборд</h1>

      {/* Client stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                <Icon size={20} />
              </div>
              <span className="text-sm text-gray-500">{label}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats ? stats[key] : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* AI Usage */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <DollarSign size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Затраты AI</h2>
          </div>
          <div className="flex gap-1">
            {Object.entries(periodLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  period === key
                    ? 'bg-purple-100 text-purple-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Total cost */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-500">Общие затраты за период</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${usage ? Number(usage.total_cost_usd).toFixed(4) : '—'}
          </p>
        </div>

        {/* Breakdown by model table */}
        <h3 className="text-sm font-medium text-gray-700 mb-2">По моделям</h3>
        {usage && usage.stats.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200 mb-6">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Провайдер</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Модель</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Тип</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Запросы</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Токены (in/out)</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {usage.stats.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 text-sm text-gray-700">{row.provider}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 font-medium">{row.model || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                        {row.task_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700">{row.requests_count}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500">
                      {(row.total_input_tokens || 0).toLocaleString()} / {(row.total_output_tokens || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                      ${Number(row.total_cost_usd || 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4 mb-6">Нет данных за выбранный период</p>
        )}

        {/* Breakdown by client */}
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">По клиентам</h3>
        </div>
        {usage && usage.stats_by_client && usage.stats_by_client.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Клиент</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Запросы</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Токены (in/out)</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {usage.stats_by_client.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 text-sm text-gray-900 font-medium">{row.client_name}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700">{row.requests_count}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500">
                      {(row.total_input_tokens || 0).toLocaleString()} / {(row.total_output_tokens || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                      ${Number(row.total_cost_usd || 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">Нет данных по клиентам</p>
        )}
      </div>
    </div>
  )
}
