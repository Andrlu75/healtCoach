import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Watch, Check, X, RefreshCw, Link2, Unlink } from 'lucide-react'
import { useHaptic } from '../../shared/hooks'
import { Card } from '../../shared/components/ui'
import api from '../../api/client'

interface GoogleFitStatus {
  connected: boolean
  last_sync_at: string | null
  error_count: number
}

function GoogleFitConnect() {
  const { impact, notification } = useHaptic()
  const [status, setStatus] = useState<GoogleFitStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await api.get('/miniapp/integrations/google-fit/status/')
      setStatus(response.data)
    } catch (error) {
      console.error('Error fetching Google Fit status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Listen for OAuth callback messages from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_FIT_AUTH_SUCCESS') {
        notification('success')
        setConnecting(false)
        fetchStatus()
      } else if (event.data?.type === 'GOOGLE_FIT_AUTH_ERROR') {
        notification('error')
        setConnecting(false)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [notification, fetchStatus])

  const handleConnect = async () => {
    impact('light')
    setConnecting(true)

    try {
      const response = await api.get('/miniapp/integrations/google-fit/auth-url/')
      const authUrl = response.data.auth_url

      // Open OAuth in popup
      const width = 500
      const height = 600
      const left = (window.screen.width - width) / 2
      const top = (window.screen.height - height) / 2

      window.open(
        authUrl,
        'google_fit_auth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      )
    } catch (error) {
      console.error('Error getting auth URL:', error)
      notification('error')
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    impact('light')
    setSyncing(true)

    try {
      await api.post('/miniapp/integrations/google-fit/sync/')
      notification('success')
      await fetchStatus()
    } catch (error) {
      console.error('Error syncing Google Fit:', error)
      notification('error')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    impact('light')
    setDisconnecting(true)

    try {
      await api.post('/miniapp/integrations/google-fit/disconnect/')
      notification('success')
      setStatus({ connected: false, last_sync_at: null, error_count: 0 })
    } catch (error) {
      console.error('Error disconnecting Google Fit:', error)
      notification('error')
    } finally {
      setDisconnecting(false)
    }
  }

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Никогда'

    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Только что'
    if (diffMins < 60) return `${diffMins} мин. назад`
    if (diffHours < 24) return `${diffHours} ч. назад`
    return `${diffDays} дн. назад`
  }

  if (loading) {
    return (
      <Card variant="elevated" className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
          <div className="flex-1">
            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse" />
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32 mt-1 animate-pulse" />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card variant="elevated" className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          status?.connected
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-gray-100 dark:bg-gray-700'
        }`}>
          <Watch size={20} className={
            status?.connected ? 'text-green-600' : 'text-gray-500'
          } />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Google Fit
            </span>
            {status?.connected && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check size={12} />
                Подключено
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {status?.connected
              ? `Синхронизация: ${formatLastSync(status.last_sync_at)}`
              : 'Шаги, пульс, сон, калории'
            }
          </p>
        </div>

        {status?.connected ? (
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSync}
              disabled={syncing}
              className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 disabled:opacity-50"
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 disabled:opacity-50"
            >
              <Unlink size={18} />
            </motion.button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {connecting ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Link2 size={16} />
            )}
            Подключить
          </motion.button>
        )}
      </div>

      {status?.connected && status.error_count > 0 && (
        <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
          <X size={14} className="text-amber-600" />
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Ошибок синхронизации: {status.error_count}
          </span>
        </div>
      )}
    </Card>
  )
}

export default GoogleFitConnect
