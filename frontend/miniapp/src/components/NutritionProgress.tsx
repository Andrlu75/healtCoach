interface Props {
  label: string
  current: number
  target: number
  unit: string
  color: string
}

export default function NutritionProgress({ label, current, target, unit, color }: Props) {
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32" cy="32" r={radius}
            fill="none" stroke="#e5e7eb" strokeWidth="5"
          />
          <circle
            cx="32" cy="32" r={radius}
            fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold">{Math.round(percent)}%</span>
        </div>
      </div>
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-xs text-gray-400">{current}/{target} {unit}</span>
    </div>
  )
}
