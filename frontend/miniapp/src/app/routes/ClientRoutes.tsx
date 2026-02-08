import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ClientLayout } from '../../features/profile/ClientLayout'
import { PageSpinner } from '../../shared/components/ui/Spinner'

const Dashboard = lazy(() => import('../../features/diary/Dashboard'))
const Diary = lazy(() => import('../../features/diary/Diary'))
const AddMeal = lazy(() => import('../../features/meals/AddMeal'))
const AddMealSmart = lazy(() => import('../../features/meals/AddMealSmart'))
const Stats = lazy(() => import('../../features/stats/Stats'))
const Reminders = lazy(() => import('../../features/reminders/Reminders'))
const Profile = lazy(() => import('../../features/profile/Profile'))
const Workouts = lazy(() => import('../../features/workouts/Workouts'))
const WorkoutDetail = lazy(() => import('../../features/workouts/WorkoutDetail'))
const WorkoutRun = lazy(() => import('../../features/workouts/WorkoutRun'))
const WorkoutReport = lazy(() => import('../../features/workouts/WorkoutReport'))
const NutritionProgram = lazy(() => import('../../features/nutrition/NutritionProgram'))
const NutritionHistory = lazy(() => import('../../features/nutrition/NutritionHistory'))

export function ClientRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route element={<ClientLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/diary/add" element={<AddMeal />} />
          <Route path="/diary/add-smart" element={<AddMealSmart />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/workouts/:id" element={<WorkoutDetail />} />
          <Route path="/workouts/:id/run" element={<WorkoutRun />} />
          <Route path="/workouts/:id/report" element={<WorkoutReport />} />
          <Route path="/nutrition" element={<NutritionProgram />} />
          <Route path="/nutrition/history" element={<NutritionHistory />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
