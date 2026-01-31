import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Download } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { nutritionProgramsApi } from '../api/nutritionPrograms'
import type { NutritionProgram, MealComplianceCheck, ComplianceStats } from '../types'

interface DayStats {
  day: number
  compliant: number
  violations: number
}

export default function NutritionProgramStats() {
  const { id } = useParams()
  const [program, setProgram] = useState<NutritionProgram | null>(null)
  const [stats, setStats] = useState<ComplianceStats | null>(null)
  const [violations, setViolations] = useState<MealComplianceCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibleViolations, setVisibleViolations] = useState(10)

  const loadData = () => {
    if (!id) return

    setLoading(true)
    setError(null)

    Promise.all([
      nutritionProgramsApi.get(Number(id)),
      nutritionProgramsApi.getStats({ program_id: Number(id) }),
      nutritionProgramsApi.getViolations({ program_id: Number(id) }),
    ])
      .then(([programRes, statsRes, violationsRes]) => {
        setProgram(programRes.data)
        setStats(statsRes.data[0] || null)
        setViolations(violationsRes.data || [])
      })
      .catch((err) => {
        console.error('Failed to load program stats:', err)
        setError('Не удалось загрузить данные. Попробуйте ещё раз.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [id])

  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <div className="text-red-400 mb-4">{error}</div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  if (!program || !stats) {
    return <div className="text-muted-foreground">Программа не найдена</div>
  }

  // Prepare chart data by day
  const dayStatsMap: Record<number, DayStats> = {}
  program.days?.forEach((day) => {
    dayStatsMap[day.day_number] = { day: day.day_number, compliant: 0, violations: 0 }
  })
  violations.forEach((v) => {
    if (dayStatsMap[v.day_number]) {
      dayStatsMap[v.day_number].violations++
    }
  })
  // Estimate compliant meals (total - violations for each day)
  const avgMealsPerDay = stats.total_meals / (program.duration_days || 1)
  Object.values(dayStatsMap).forEach((d) => {
    d.compliant = Math.max(0, Math.round(avgMealsPerDay - d.violations))
  })
  const chartData = Object.values(dayStatsMap).slice(0, 14) // Limit to 14 days for chart

  // Top violated ingredients
  const ingredientCounts: Record<string, number> = {}
  violations.forEach((v) => {
    v.found_forbidden.forEach((ing: string) => {
      ingredientCounts[ing] = (ingredientCounts[ing] || 0) + 1
    })
  })
  const topIngredients = Object.entries(ingredientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }

  const exportToCSV = () => {
    if (!program || !stats) return

    // Header
    const headers = ['Дата', 'День', 'Блюдо', 'Запрещённые продукты']
    const rows = violations.map((v) => [
      new Date(v.meal_time).toLocaleDateString('ru-RU'),
      `День ${v.day_number}`,
      v.meal_name,
      v.found_forbidden.join(', '),
    ])

    // Add summary at the top
    const summary = [
      ['Программа:', program.name],
      ['Клиент:', stats.client_name],
      ['Период:', `${formatDate(program.start_date)} - ${formatDate(program.end_date)}`],
      ['Всего приёмов:', stats.total_meals.toString()],
      ['Соответствий:', stats.compliant_meals.toString()],
      ['Нарушений:', stats.violations.toString()],
      ['Соблюдение:', `${stats.compliance_rate}%`],
      [],
      headers,
      ...rows,
    ]

    const csvContent = summary
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `nutrition-stats-${program.name}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="max-w-6xl">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/nutrition-programs" className="hover:text-foreground">
          Программы питания
        </Link>
        <ChevronRight size={14} />
        <Link to={`/nutrition-programs/${id}`} className="hover:text-foreground">
          {program.name}
        </Link>
        <ChevronRight size={14} />
        <span className="text-foreground">Статистика</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">{program.name}</h1>
          <p className="text-muted-foreground">
            {stats.client_name} | {formatDate(program.start_date)} - {formatDate(program.end_date)}
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
        >
          <Download size={16} />
          Экспорт CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="text-sm text-muted-foreground mb-1">Всего приёмов</div>
          <div className="text-2xl font-bold text-foreground">{stats.total_meals}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1 text-sm text-green-400 mb-1">
            <CheckCircle size={14} />
            Соответствий
          </div>
          <div className="text-2xl font-bold text-green-400">{stats.compliant_meals}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1 text-sm text-red-400 mb-1">
            <AlertTriangle size={14} />
            Нарушений
          </div>
          <div className="text-2xl font-bold text-red-400">{stats.violations}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
            {stats.compliance_rate >= 80 ? (
              <TrendingUp size={14} className="text-green-400" />
            ) : (
              <TrendingDown size={14} className="text-red-400" />
            )}
            Соблюдение
          </div>
          <div
            className={`text-2xl font-bold ${stats.compliance_rate >= 80 ? 'text-green-400' : stats.compliance_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}
          >
            {stats.compliance_rate}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Bar chart by day */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">По дням</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3a" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161922',
                    border: '1px solid #2a2e3a',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="compliant" stackId="a" fill="#22c55e" name="Соответствий" />
                <Bar dataKey="violations" stackId="a" fill="#ef4444" name="Нарушений" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted-foreground text-center py-8">Нет данных</div>
          )}
        </div>

        {/* Top violated ingredients */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Частые нарушения</h2>
          {topIngredients.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={topIngredients}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {topIngredients.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161922',
                      border: '1px solid #2a2e3a',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {topIngredients.map((ing, i) => (
                  <div key={ing.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-sm text-foreground">{ing.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{ing.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-8">Нет нарушений</div>
          )}
        </div>
      </div>

      {/* Violations table */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Последние нарушения</h2>
          {violations.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Всего: {violations.length}
            </span>
          )}
        </div>
        {violations.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-sm font-medium text-muted-foreground">
                      Дата
                    </th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-muted-foreground">
                      День
                    </th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-muted-foreground">
                      Блюдо
                    </th>
                    <th className="text-left px-4 py-2 text-sm font-medium text-muted-foreground">
                      Запрещённые продукты
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {violations.slice(0, visibleViolations).map((v) => (
                    <tr key={v.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(v.meal_time).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">День {v.day_number}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{v.meal_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {v.found_forbidden.map((ing: string, i: number) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded"
                            >
                              {ing}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {violations.length > visibleViolations && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setVisibleViolations((prev) => prev + 10)}
                  className="px-4 py-2 text-sm text-primary hover:text-primary/80"
                >
                  Показать ещё ({violations.length - visibleViolations} осталось)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-muted-foreground text-center py-8">Нарушений не найдено</div>
        )}
      </div>
    </div>
  )
}
