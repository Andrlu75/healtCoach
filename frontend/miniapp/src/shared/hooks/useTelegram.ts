import { useCallback, useEffect } from 'react'
import WebApp from '@twa-dev/sdk'

export function useTelegram() {
  useEffect(() => {
    WebApp.ready()
    WebApp.expand()
  }, [])

  const showMainButton = useCallback((text: string, onClick: () => void) => {
    WebApp.MainButton.setText(text)
    WebApp.MainButton.onClick(onClick)
    WebApp.MainButton.show()
  }, [])

  const hideMainButton = useCallback(() => {
    WebApp.MainButton.hide()
  }, [])

  const showBackButton = useCallback((onClick: () => void) => {
    WebApp.BackButton.onClick(onClick)
    WebApp.BackButton.show()
  }, [])

  const hideBackButton = useCallback(() => {
    WebApp.BackButton.hide()
  }, [])

  const close = useCallback(() => {
    WebApp.close()
  }, [])

  const showAlert = useCallback((message: string) => {
    WebApp.showAlert(message)
  }, [])

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      WebApp.showConfirm(message, resolve)
    })
  }, [])

  return {
    user: WebApp.initDataUnsafe?.user,
    colorScheme: WebApp.colorScheme,
    themeParams: WebApp.themeParams,
    platform: WebApp.platform,
    isExpanded: WebApp.isExpanded,
    viewportHeight: WebApp.viewportHeight,
    viewportStableHeight: WebApp.viewportStableHeight,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
    close,
    showAlert,
    showConfirm,
  }
}
