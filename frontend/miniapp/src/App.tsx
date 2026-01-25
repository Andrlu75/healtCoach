import dayjs from 'dayjs'
import 'dayjs/locale/ru'

import { Providers } from './app/providers'
import { AuthGate } from './features/auth'
import { ClientRoutes } from './app/routes/ClientRoutes'

dayjs.locale('ru')

export default function App() {
  return (
    <Providers>
      <AuthGate>
        <ClientRoutes />
      </AuthGate>
    </Providers>
  )
}
