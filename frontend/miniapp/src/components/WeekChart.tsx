import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DayData {
  date: string
  label: string
  calories: number
}

export default function WeekChart({ data }: { data: DayData[] }) {
  if (!data.length) {
    return <p className="text-sm text-gray-400 text-center py-8">Нет данных</p>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`${value} ккал`, 'Калории']}
          labelFormatter={(label) => String(label)}
        />
        <Bar dataKey="calories" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
