import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, BookOpen, BarChart3, Bell, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../../shared/lib/cn'
import { useHaptic } from '../../shared/hooks'

const navItems = [
  { to: '/', icon: Home, label: 'Главная' },
  { to: '/diary', icon: BookOpen, label: 'Дневник' },
  { to: '/stats', icon: BarChart3, label: 'Статистика' },
  { to: '/reminders', icon: Bell, label: 'Напоминания' },
  { to: '/profile', icon: User, label: 'Профиль' },
]

export function ClientLayout() {
  const location = useLocation()
  const { selection } = useHaptic()

  const handleNavClick = () => {
    selection()
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="flex-1 pb-16 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-area-bottom">
        <div className="flex justify-around items-center h-14">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname === to ||
              (to !== '/' && location.pathname.startsWith(to))

            return (
              <NavLink
                key={to}
                to={to}
                onClick={handleNavClick}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-blue-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon
                  size={20}
                  className={cn(
                    'transition-colors',
                    isActive
                      ? 'text-blue-600'
                      : 'text-gray-400 dark:text-gray-500'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px]',
                    isActive
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
