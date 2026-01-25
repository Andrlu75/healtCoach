import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts'
import dayjs from 'dayjs'

interface DayData {
  date: string
  label: string
  calories: number
}

interface WeekChartProps {
  data: DayData[]
}

export function WeekChart({ data }: WeekChartProps) {
  const today = dayjs().format('YYYY-MM-DD')
  const maxCalories = Math.max(...data.map((d) => d.calories), 1)

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#9ca3af' }}
          />
          <YAxis hide domain={[0, maxCalories * 1.1]} />
          <Bar dataKey="calories" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={entry.date === today ? '#3b82f6' : '#e5e7eb'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
