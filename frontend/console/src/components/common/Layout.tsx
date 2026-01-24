import { Link, useLocation, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Bot, Brain, Send, LogOut, FileText, ClipboardList, LinkIcon } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/clients', icon: Users, label: 'Клиенты' },
  { to: '/reports', icon: FileText, label: 'Отчёты' },
  { to: '/onboarding', icon: ClipboardList, label: 'Онбординг' },
  { to: '/invites', icon: LinkIcon, label: 'Инвайты' },
  { to: '/settings/persona', icon: Bot, label: 'Персона бота' },
  { to: '/settings/ai', icon: Brain, label: 'AI настройки' },
  { to: '/settings/telegram', icon: Send, label: 'Telegram' },
]

export default function Layout() {
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Health Coach</h1>
          <p className="text-sm text-gray-500">Консоль управления</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to ||
              (to !== '/' && location.pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 w-full"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
