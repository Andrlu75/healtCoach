import { useCallback } from 'react'
import WebApp from '@twa-dev/sdk'

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type NotificationType = 'error' | 'success' | 'warning'

export function useHaptic() {
  const impact = useCallback((style: ImpactStyle = 'light') => {
    try {
      WebApp.HapticFeedback?.impactOccurred(style)
    } catch {
      // Haptic not available
    }
  }, [])

  const notification = useCallback((type: NotificationType) => {
    try {
      WebApp.HapticFeedback?.notificationOccurred(type)
    } catch {
      // Haptic not available
    }
  }, [])

  const selection = useCallback(() => {
    try {
      WebApp.HapticFeedback?.selectionChanged()
    } catch {
      // Haptic not available
    }
  }, [])

  return { impact, notification, selection }
}
