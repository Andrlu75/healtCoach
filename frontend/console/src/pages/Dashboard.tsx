import { useEffect, useState } from 'react'
import { Users, UserCheck, UserPlus, UserX } from 'lucide-react'
import { settingsApi } from '../api/settings'
import type { DashboardStats } from '../types'

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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    settingsApi.getDashboardStats()
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-gray-500">Загрузка...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Дашборд</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
    </div>
  )
}
