import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ClientLayout } from '../../features/profile/ClientLayout'
import { PageSpinner } from '../../shared/components/ui/Spinner'

const Dashboard = lazy(() => import('../../features/diary/Dashboard'))
const Diary = lazy(() => import('../../features/diary/Diary'))
const AddMeal = lazy(() => import('../../features/meals/AddMeal'))
const Stats = lazy(() => import('../../features/stats/Stats'))
const Reminders = lazy(() => import('../../features/reminders/Reminders'))
const Profile = lazy(() => import('../../features/profile/Profile'))

export function ClientRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route element={<ClientLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/diary/add" element={<AddMeal />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
