import { NavLink, Outlet } from 'react-router-dom'
import { Home, BookOpen, BarChart3, Bell } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Главная' },
  { to: '/diary', icon: BookOpen, label: 'Дневник' },
  { to: '/stats', icon: BarChart3, label: 'Статистика' },
  { to: '/reminders', icon: Bell, label: 'Напоминания' },
]

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <main className="flex-1 pb-16 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex justify-around items-center h-14">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
