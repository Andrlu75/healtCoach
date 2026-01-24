import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { clientsApi } from '../api/clients'
import type { Client } from '../types'

const statusLabels: Record<string, { label: string; class: string }> = {
  active: { label: 'Активен', class: 'bg-green-100 text-green-700' },
  pending: { label: 'Ожидает', class: 'bg-yellow-100 text-yellow-700' },
  paused: { label: 'На паузе', class: 'bg-gray-100 text-gray-700' },
  archived: { label: 'Архив', class: 'bg-red-100 text-red-700' },
}

export default function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadClients()
  }, [filter])

  const loadClients = () => {
    setLoading(true)
    clientsApi.list({ status: filter || undefined, search: search || undefined })
      .then(({ data }) => setClients(data.results || []))
      .finally(() => setLoading(false))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadClients()
  }

  const handleAction = async (e: React.MouseEvent, id: number, action: 'pause' | 'activate' | 'archive') => {
    e.stopPropagation()
    await clientsApi[action](id)
    loadClients()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Клиенты</h1>

      <div className="flex items-center gap-4 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </form>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="pending">Ожидают</option>
          <option value="paused">На паузе</option>
          <option value="archived">Архив</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500">Загрузка...</div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Клиенты не найдены
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Имя</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Telegram</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Статус</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Город</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Персона</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Приёмы пищи</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Действия</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} onClick={() => navigate(`/clients/${client.id}`)} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{client.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">@{client.telegram_username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabels[client.status]?.class}`}>
                      {statusLabels[client.status]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{client.city || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{client.persona_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{client.meals_count ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {client.status === 'active' && (
                      <button
                        onClick={(e) => handleAction(e, client.id, 'pause')}
                        className="text-xs text-gray-500 hover:text-gray-700 mr-2"
                      >
                        Пауза
                      </button>
                    )}
                    {client.status === 'paused' && (
                      <button
                        onClick={(e) => handleAction(e, client.id, 'activate')}
                        className="text-xs text-green-600 hover:text-green-700 mr-2"
                      >
                        Активировать
                      </button>
                    )}
                    {client.status !== 'archived' && (
                      <button
                        onClick={(e) => handleAction(e, client.id, 'archive')}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Архив
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
