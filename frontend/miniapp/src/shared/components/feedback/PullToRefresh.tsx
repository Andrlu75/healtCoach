import { useState, useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Spinner } from '../ui/Spinner'

interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => Promise<void>
  isRefreshing?: boolean
}

const PULL_THRESHOLD = 80

export function PullToRefresh({ children, onRefresh, isRefreshing = false }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const pullDistance = useMotionValue(0)

  const spinnerOpacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1])
  const spinnerScale = useTransform(pullDistance, [0, PULL_THRESHOLD], [0.5, 1])
  const spinnerY = useTransform(pullDistance, [0, PULL_THRESHOLD * 1.5], [0, PULL_THRESHOLD])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      setIsPulling(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return

    const currentY = e.touches[0].clientY
    const diff = Math.max(0, currentY - startY.current)
    const dampedDiff = Math.min(diff * 0.5, PULL_THRESHOLD * 1.5)
    pullDistance.set(dampedDiff)
  }

  const handleTouchEnd = async () => {
    if (!isPulling) return

    const currentPull = pullDistance.get()

    if (currentPull >= PULL_THRESHOLD && !isRefreshing) {
      await onRefresh()
    }

    pullDistance.set(0)
    setIsPulling(false)
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 z-10"
        style={{
          opacity: isRefreshing ? 1 : spinnerOpacity,
          scale: isRefreshing ? 1 : spinnerScale,
          y: isRefreshing ? 20 : spinnerY,
        }}
      >
        <Spinner size="md" />
      </motion.div>

      <motion.div
        style={{
          y: isRefreshing ? PULL_THRESHOLD / 2 : useTransform(pullDistance, [0, PULL_THRESHOLD * 1.5], [0, PULL_THRESHOLD / 2]),
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
