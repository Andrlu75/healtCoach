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

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Отчёты</h1>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <RefreshCw size={16} />
          Сгенерировать
        </button>
      </div>

      {/* Generate modal */}
      {showGenerate && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 mb-4">
          <h3 className="text-sm font-medium mb-3">Новый отчёт</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500">Клиент</label>
              <select
                value={genClient}
                onChange={(e) => setGenClient(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
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
              <label className="text-xs text-gray-500">Тип</label>
              <select
                value={genType}
                onChange={(e) => setGenType(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="daily">Дневной</option>
                <option value="weekly">Недельный</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Дата</label>
              <input
                type="date"
                value={genDate}
                onChange={(e) => setGenDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={generating || !genClient}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? 'Генерация...' : 'Создать'}
            </button>
            <button
              onClick={() => setShowGenerate(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
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
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
        >
          <option value="">Все типы</option>
          <option value="daily">Дневные</option>
          <option value="weekly">Недельные</option>
        </select>
      </div>

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Отчёты не найдены
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Клиент</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Период</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Сводка</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">PDF</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Создан</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm text-gray-900">{r.client_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.report_type === 'daily'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {r.report_type === 'daily' ? 'Дневной' : 'Недельный'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {dayjs(r.period_start).format('DD.MM')} — {dayjs(r.period_end).format('DD.MM')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {r.summary || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.pdf_url ? (
                      <a
                        href={r.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      >
                        <Download size={14} />
                      </a>
                    ) : (
                      <FileText size={14} className="text-gray-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {dayjs(r.created_at).format('DD.MM.YY HH:mm')}
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
