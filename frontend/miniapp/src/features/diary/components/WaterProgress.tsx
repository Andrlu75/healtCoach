import { motion } from 'framer-motion'

interface WaterProgressProps {
  current: number
  target: number
}

export function WaterProgress({ current, target }: WaterProgressProps) {
  const percentage = Math.min((current / target) * 100, 100)

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {current.toFixed(1)} л
        </span>
        <span className="text-sm text-gray-400 dark:text-gray-500">
          из {target} л
        </span>
      </div>
      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
        />
      </div>
    </div>
  )
}
