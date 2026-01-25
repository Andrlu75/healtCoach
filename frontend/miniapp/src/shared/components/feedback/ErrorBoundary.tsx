import { Component, type ReactNode } from 'react'
import { Button } from '../ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
          <div className="text-4xl mb-4">:(</div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Что-то пошло не так
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
            Произошла ошибка при загрузке
          </p>
          <Button onClick={this.handleRetry}>
            Попробовать снова
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  error?: Error | null
  onRetry?: () => void
  message?: string
}

export function ErrorFallback({ onRetry, message }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
      <div className="text-4xl mb-4">:(</div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Ошибка загрузки
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
        {message || 'Не удалось загрузить данные'}
      </p>
      {onRetry && (
        <Button onClick={onRetry}>
          Попробовать снова
        </Button>
      )}
    </div>
  )
}
