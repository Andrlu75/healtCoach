import { Link, useLocation, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Bot, Brain, Send, LogOut, FileText, ClipboardList, LinkIcon, ScrollText, Dumbbell } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'

const nav: { to: string; icon: React.ComponentType<{ size?: number }>; label: string; highlight?: boolean }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/clients', icon: Users, label: 'Клиенты' },
  { to: '/fitdb', icon: Dumbbell, label: 'Тренировки' },
  { to: '/logs', icon: ScrollText, label: 'Логи' },
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
    <div className="flex h-screen" style={{ background: '#0f1117' }}>
      <aside className="w-64 flex flex-col" style={{ background: '#161922', borderRight: '1px solid #2a2e3a' }}>
        <div className="p-6" style={{ borderBottom: '1px solid #2a2e3a' }}>
          <h1 className="text-xl font-bold" style={{ color: '#f8fafc' }}>Health Coach</h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>Консоль управления</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, highlight }) => {
            const active = location.pathname === to ||
              (to !== '/' && location.pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: active ? 'rgba(163, 230, 53, 0.15)' : highlight && !active ? 'rgba(163, 230, 53, 0.05)' : 'transparent',
                  color: active ? '#a3e635' : highlight ? '#a3e635' : '#94a3b8',
                  border: highlight && !active ? '1px solid rgba(163, 230, 53, 0.3)' : '1px solid transparent',
                }}
              >
                <Icon size={18} />
                {label}
                {highlight && !active && (
                  <span
                    className="ml-auto px-1.5 py-0.5 text-[10px] rounded font-semibold"
                    style={{ background: 'rgba(163, 230, 53, 0.2)', color: '#a3e635' }}
                  >
                    NEW
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="p-4" style={{ borderTop: '1px solid #2a2e3a' }}>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors"
            style={{ color: '#94a3b8' }}
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8" style={{ background: '#0f1117' }}>
        <Outlet />
      </main>
    </div>
  )
}
