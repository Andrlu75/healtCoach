import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { logsApi } from '../api/data'
import { clientsApi } from '../api/clients'
import type { InteractionLog, Client } from '../types'
import dayjs from 'dayjs'

const TYPE_LABELS: Record<string, string> = {
  text: 'Текст',
  vision: 'Фото',
  voice: 'Голос',
}

const TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-500/20 text-blue-400',
  vision: 'bg-green-500/20 text-green-400',
  voice: 'bg-purple-500/20 text-purple-400',
}

export default function Logs() {
  const [logs, setLogs] = useState<InteractionLog[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [filterClient, setFilterClient] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  useEffect(() => {
    clientsApi.list({}).then(({ data }) => setClients(data.results || []))
  }, [])

  useEffect(() => {
    loadLogs()
  }, [filterClient, filterType, filterDateFrom, filterDateTo, page])

  const loadLogs = () => {
    setLoading(true)
    const params: Record<string, unknown> = { page, page_size: 50 }
    if (filterClient) params.client_id = Number(filterClient)
    if (filterType) params.interaction_type = filterType
    if (filterDateFrom) params.date_from = filterDateFrom
    if (filterDateTo) params.date_to = filterDateTo

    logsApi.list(params as Parameters<typeof logsApi.list>[0])
      .then(({ data }) => {
        setLogs(data.results)
        setCount(data.count)
      })
      .finally(() => setLoading(false))
  }

  const totalPages = Math.ceil(count / 50)

  const truncate = (text: string, len = 80) =>
    text.length > len ? text.slice(0, len) + '...' : text

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Логи взаимодействий</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterClient}
          onChange={(e) => { setFilterClient(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm bg-card text-foreground border border-border rounded-lg"
        >
          <option value="">Все клиенты</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm bg-card text-foreground border border-border rounded-lg"
        >
          <option value="">Все типы</option>
          <option value="text">Текст</option>
          <option value="vision">Фото</option>
          <option value="voice">Голос</option>
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm bg-card text-foreground border border-border rounded-lg"
          placeholder="С"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => { setFilterDateTo(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm bg-card text-foreground border border-border rounded-lg"
          placeholder="По"
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : logs.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Логи не найдены
        </div>
      ) : (
        <>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="w-8 px-3 py-3"></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Время</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Клиент</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Тип</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Ввод</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Ответ</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Модель</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">ms</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className="border-b border-border/50 hover:bg-muted cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="px-3 py-3 text-muted-foreground">
                        {expandedId === log.id
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {dayjs(log.created_at).format('DD.MM HH:mm:ss')}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{log.client_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[log.interaction_type] || ''}`}>
                          {TYPE_LABELS[log.interaction_type] || log.interaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary-foreground max-w-[200px] truncate">
                        {truncate(log.client_input)}
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary-foreground max-w-[200px] truncate">
                        {truncate(log.client_output)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.provider}/{log.model}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                        {log.duration_ms}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr className="border-b border-border/50 bg-muted">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-2">AI Request</h4>
                              <pre className="text-xs bg-card text-foreground border border-border rounded-lg p-3 overflow-auto max-h-64">
                                {JSON.stringify(log.ai_request, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-2">AI Response</h4>
                              <pre className="text-xs bg-card text-foreground border border-border rounded-lg p-3 overflow-auto max-h-64">
                                {JSON.stringify(log.ai_response, null, 2)}
                              </pre>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">Полный ввод клиента</h4>
                              <div className="bg-card border border-border rounded-lg p-3">
                                <p className="text-sm text-secondary-foreground">{log.client_input}</p>
                                {log.image_url && (
                                  <img
                                    src={log.image_url}
                                    alt="Фото от клиента"
                                    className="mt-2 max-w-xs rounded-lg shadow-sm"
                                  />
                                )}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">Полный ответ клиенту</h4>
                              <p className="text-sm text-secondary-foreground bg-card border border-border rounded-lg p-3 whitespace-pre-wrap">
                                {log.client_output}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Всего: {count} записей
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm text-foreground border border-border rounded-lg disabled:opacity-50 hover:bg-muted"
                >
                  Назад
                </button>
                <span className="px-3 py-1.5 text-sm text-secondary-foreground">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm text-foreground border border-border rounded-lg disabled:opacity-50 hover:bg-muted"
                >
                  Далее
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
