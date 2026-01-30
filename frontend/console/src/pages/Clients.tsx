import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { clientsApi } from '../api/clients'
import type { Client } from '../types'

const statusLabels: Record<string, { label: string; class: string }> = {
  active: { label: 'Активен', class: 'bg-green-500/20 text-green-400' },
  pending: { label: 'Ожидает', class: 'bg-yellow-500/20 text-yellow-400' },
  paused: { label: 'На паузе', class: 'bg-secondary text-secondary-foreground' },
  archived: { label: 'Архив', class: 'bg-red-500/20 text-red-400' },
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
      <h1 className="text-2xl font-bold text-foreground mb-6">Клиенты</h1>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени..."
            className="w-full pl-9 pr-3 py-2 bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none placeholder:text-muted-foreground"
          />
        </form>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 bg-card text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="pending">Ожидают</option>
          <option value="paused">На паузе</option>
          <option value="archived">Архив</option>
        </select>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : clients.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Клиенты не найдены
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {clients.map((client) => (
              <div
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="bg-card rounded-xl border border-border p-4 cursor-pointer active:bg-muted"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-foreground">{client.full_name}</div>
                    <div className="text-sm text-muted-foreground">@{client.telegram_username}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabels[client.status]?.class}`}>
                    {statusLabels[client.status]?.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                  {client.city && <span>📍 {client.city}</span>}
                  {client.persona_name && <span>🤖 {client.persona_name}</span>}
                  <span>🍽 {client.meals_count ?? 0} приёмов</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  {client.status === 'active' && (
                    <button
                      onClick={(e) => handleAction(e, client.id, 'pause')}
                      className="text-xs px-3 py-1.5 bg-muted rounded-lg text-muted-foreground"
                    >
                      Пауза
                    </button>
                  )}
                  {client.status === 'paused' && (
                    <button
                      onClick={(e) => handleAction(e, client.id, 'activate')}
                      className="text-xs px-3 py-1.5 bg-green-500/20 rounded-lg text-green-400"
                    >
                      Активировать
                    </button>
                  )}
                  {client.status !== 'archived' && (
                    <button
                      onClick={(e) => handleAction(e, client.id, 'archive')}
                      className="text-xs px-3 py-1.5 bg-red-500/20 rounded-lg text-red-400"
                    >
                      Архив
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Имя</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Telegram</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Статус</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Город</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Персона</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Приёмы пищи</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} onClick={() => navigate(`/clients/${client.id}`)} className="border-b border-border/50 hover:bg-muted cursor-pointer">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{client.full_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">@{client.telegram_username}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusLabels[client.status]?.class}`}>
                        {statusLabels[client.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{client.city || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{client.persona_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{client.meals_count ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {client.status === 'active' && (
                        <button
                          onClick={(e) => handleAction(e, client.id, 'pause')}
                          className="text-xs text-muted-foreground hover:text-foreground mr-2"
                        >
                          Пауза
                        </button>
                      )}
                      {client.status === 'paused' && (
                        <button
                          onClick={(e) => handleAction(e, client.id, 'activate')}
                          className="text-xs text-green-400 hover:text-green-300 mr-2"
                        >
                          Активировать
                        </button>
                      )}
                      {client.status !== 'archived' && (
                        <button
                          onClick={(e) => handleAction(e, client.id, 'archive')}
                          className="text-xs text-red-400 hover:text-red-300"
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
        </>
      )}
    </div>
  )
}
