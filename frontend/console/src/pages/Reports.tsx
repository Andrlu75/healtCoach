import { useEffect, useState } from 'react'
import { FileText, Download, RefreshCw } from 'lucide-react'
import { reportsApi } from '../api/data'
import { clientsApi } from '../api/clients'
import type { Report, Client } from '../types'
import dayjs from 'dayjs'

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filterClient, setFilterClient] = useState('')
  const [filterType, setFilterType] = useState('')

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false)
  const [genClient, setGenClient] = useState('')
  const [genType, setGenType] = useState('daily')
  const [genDate, setGenDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    clientsApi.list({ status: 'active' }).then(({ data }) => setClients(data.results || []))
  }, [])

  useEffect(() => {
    loadReports()
  }, [filterClient, filterType])

  const loadReports = () => {
    setLoading(true)
    const params: { client_id?: number; type?: string } = {}
    if (filterClient) params.client_id = Number(filterClient)
    if (filterType) params.type = filterType
    reportsApi.list(params).then(({ data }) => {
      const d = data as unknown as { results?: Report[] }
      setReports(Array.isArray(data) ? data : d.results || [])
    }).finally(() => setLoading(false))
  }

  const generate = async () => {
    if (!genClient) return
    setGenerating(true)
    try {
      await reportsApi.generate(Number(genClient), genType, genDate)
      setShowGenerate(false)
      loadReports()
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="text-muted-foreground">Загрузка...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Отчёты</h1>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90"
        >
          <RefreshCw size={16} />
          Сгенерировать
        </button>
      </div>

      {/* Generate modal */}
      {showGenerate && (
        <div className="bg-card rounded-xl border border-primary/30 p-4 mb-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Новый отчёт</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-muted-foreground">Клиент</label>
              <select
                value={genClient}
                onChange={(e) => setGenClient(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-background text-foreground border border-border rounded-lg"
              >
                <option value="">Выберите...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Тип</label>
              <select
                value={genType}
                onChange={(e) => setGenType(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-background text-foreground border border-border rounded-lg"
              >
                <option value="daily">Дневной</option>
                <option value="weekly">Недельный</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Дата</label>
              <input
                type="date"
                value={genDate}
                onChange={(e) => setGenDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-background text-foreground border border-border rounded-lg"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={generating || !genClient}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {generating ? 'Генерация...' : 'Создать'}
            </button>
            <button
              onClick={() => setShowGenerate(false)}
              className="px-3 py-1.5 text-sm text-secondary-foreground hover:bg-muted rounded-lg"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
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
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm bg-card text-foreground border border-border rounded-lg"
        >
          <option value="">Все типы</option>
          <option value="daily">Дневные</option>
          <option value="weekly">Недельные</option>
        </select>
      </div>

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Отчёты не найдены
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-foreground">{r.client_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {dayjs(r.period_start).format('DD.MM')} — {dayjs(r.period_end).format('DD.MM')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.report_type === 'daily'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {r.report_type === 'daily' ? 'Дн.' : 'Нед.'}
                    </span>
                    {r.pdf_url && (
                      <a
                        href={r.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-primary/20 text-primary rounded-lg"
                      >
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                </div>
                {r.summary && (
                  <p className="text-sm text-secondary-foreground line-clamp-2">{r.summary}</p>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {dayjs(r.created_at).format('DD.MM.YY HH:mm')}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Клиент</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Тип</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Период</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Сводка</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">PDF</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Создан</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-sm text-foreground">{r.client_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.report_type === 'daily'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {r.report_type === 'daily' ? 'Дневной' : 'Недельный'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {dayjs(r.period_start).format('DD.MM')} — {dayjs(r.period_end).format('DD.MM')}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-foreground max-w-xs truncate">
                      {r.summary || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.pdf_url ? (
                        <a
                          href={r.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
                        >
                          <Download size={14} />
                        </a>
                      ) : (
                        <FileText size={14} className="text-muted-foreground/50 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {dayjs(r.created_at).format('DD.MM.YY HH:mm')}
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
