import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryProvider } from './QueryProvider'
import { ThemeProvider } from './ThemeProvider'
import { TelegramProvider } from './TelegramProvider'
import { ErrorBoundary } from '../../shared/components/feedback/ErrorBoundary'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <TelegramProvider>
        <ThemeProvider>
          <QueryProvider>
            <BrowserRouter>
              {children}
            </BrowserRouter>
          </QueryProvider>
        </ThemeProvider>
      </TelegramProvider>
    </ErrorBoundary>
  )
}
