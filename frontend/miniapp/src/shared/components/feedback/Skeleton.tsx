import { cn } from '../../lib/cn'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg',
        className
      )}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function MealCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  )
}

export function NutritionSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="w-14 h-14 rounded-full" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <MealCardSkeleton key={i} />
      ))}
    </div>
  )
}
