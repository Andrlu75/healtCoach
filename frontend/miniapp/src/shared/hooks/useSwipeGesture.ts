import { useRef, useState, useCallback } from 'react'

interface SwipeGestureOptions {
  threshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

export function useSwipeGesture(options: SwipeGestureOptions = {}) {
  const { threshold = 50, onSwipeLeft, onSwipeRight } = options
  const startX = useRef(0)
  const [offsetX, setOffsetX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    setIsSwiping(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startX.current
    setOffsetX(diff)
  }, [isSwiping])

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return

    if (offsetX < -threshold && onSwipeLeft) {
      onSwipeLeft()
    } else if (offsetX > threshold && onSwipeRight) {
      onSwipeRight()
    }

    setOffsetX(0)
    setIsSwiping(false)
  }, [isSwiping, offsetX, threshold, onSwipeLeft, onSwipeRight])

  return {
    offsetX,
    isSwiping,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}
