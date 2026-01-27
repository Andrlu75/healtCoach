import type { ReactNode } from 'react';
import { Home, BookOpen, BarChart3, User, Dumbbell } from 'lucide-react';

type TabId = 'home' | 'diary' | 'stats' | 'workouts' | 'profile';

interface MiniAppLayoutProps {
  children: ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const MiniAppLayout = ({ children, activeTab, onTabChange }: MiniAppLayoutProps) => {
  const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'diary', label: 'Дневник', icon: BookOpen },
    { id: 'stats', label: 'Статистика', icon: BarChart3 },
    { id: 'workouts', label: 'Тренировки', icon: Dumbbell },
    { id: 'profile', label: 'Профиль', icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Main Content */}
      <main className="flex-1 px-4 py-6 pb-24 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 safe-area-pb max-w-md mx-auto">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                  isActive
                    ? 'text-blue-500'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-xs ${isActive ? 'font-medium' : ''}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default MiniAppLayout;
