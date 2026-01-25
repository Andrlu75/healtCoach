interface NutritionProgressProps {
  label: string
  current: number
  target: number
  unit: string
  color: string
}

export function NutritionProgress({ label, current, target, unit, color }: NutritionProgressProps) {
  const percentage = Math.min((current / target) * 100, 100)
  const circumference = 2 * Math.PI * 20
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90">
          <circle
            cx="28"
            cy="28"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-gray-100 dark:text-gray-800"
          />
          <circle
            cx="28"
            cy="28"
            r="20"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">
        {label}
      </span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500">
        {current}/{target} {unit}
      </span>
    </div>
  )
}
