import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Bot, Brain, Send, LogOut, FileText, ClipboardList, LinkIcon, ScrollText, Dumbbell, Menu, X, UserCog, Utensils, ChefHat, Package } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'

const nav: { to: string; icon: React.ComponentType<{ size?: number }>; label: string; highlight?: boolean }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/clients', icon: Users, label: 'Клиенты' },
  { to: '/nutrition-programs', icon: Utensils, label: 'Программы питания' },
  { to: '/dishes', icon: ChefHat, label: 'База блюд' },
  { to: '/products', icon: Package, label: 'База продуктов' },
  { to: '/fitdb', icon: Dumbbell, label: 'Тренировки' },
  { to: '/logs', icon: ScrollText, label: 'Логи' },
  { to: '/reports', icon: FileText, label: 'Отчёты' },
  { to: '/onboarding', icon: ClipboardList, label: 'Онбординг' },
  { to: '/invites', icon: LinkIcon, label: 'Инвайты' },
  { to: '/settings/persona', icon: Bot, label: 'Персона бота' },
  { to: '/settings/ai', icon: Brain, label: 'AI настройки' },
  { to: '/settings/telegram', icon: Send, label: 'Telegram' },
  { to: '/settings/account', icon: UserCog, label: 'Аккаунт' },
]

export default function Layout() {
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="flex h-screen" style={{ background: '#0f1117' }}>
      {/* Mobile header */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 md:hidden"
        style={{ background: '#161922', borderBottom: '1px solid #2a2e3a' }}
      >
        <h1 className="text-lg font-bold" style={{ color: '#f8fafc' }}>Health Coach</h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg"
          style={{ color: '#94a3b8' }}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar - hidden on mobile, shown on md+ */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: '#161922', borderRight: '1px solid #2a2e3a' }}
      >
        <div className="p-6 hidden md:block" style={{ borderBottom: '1px solid #2a2e3a' }}>
          <h1 className="text-xl font-bold" style={{ color: '#f8fafc' }}>Health Coach</h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>Консоль управления</p>
        </div>
        {/* Mobile: add top padding for header */}
        <div className="h-14 md:hidden" />
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, icon: Icon, label, highlight }) => {
            const active = location.pathname === to ||
              (to !== '/' && location.pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                onClick={closeMobileMenu}
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
            onClick={() => { logout(); closeMobileMenu(); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors"
            style={{ color: '#94a3b8' }}
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className="flex-1 overflow-auto p-4 md:p-8 pt-16 md:pt-8"
        style={{ background: '#0f1117' }}
      >
        <Outlet />
      </main>
    </div>
  )
}
