interface NutritionProgressProps {
  label: string
  current: number
  target: number
  unit: string
  color: string
}

export function NutritionProgress({ label, current, target, unit, color }: NutritionProgressProps) {
  const percentage = Math.min((current / target) * 100, 100)
  const circumference = 2 * Math.PI * 28
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[72px] h-[72px]">
        <svg className="w-[72px] h-[72px] -rotate-90">
          <circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-gray-100 dark:text-gray-800"
          />
          <circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1.5">
        {label}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {current}/{target} {unit}
      </span>
    </div>
  )
}
