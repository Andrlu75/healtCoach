import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Copy,
  Trash2,
  Edit,
  Clock,
  Dumbbell,
  Layers,
  Filter,
} from 'lucide-react'
import { workoutTemplatesApi } from '../../api/workouts'
import type { WorkoutTemplate } from '../../types'

const difficultyConfig: Record<string, { label: string; class: string; bg: string }> = {
  beginner: {
    label: 'Начинающий',
    class: 'text-green-700',
    bg: 'bg-gradient-to-r from-green-50 to-green-100',
  },
  intermediate: {
    label: 'Средний',
    class: 'text-yellow-700',
    bg: 'bg-gradient-to-r from-yellow-50 to-yellow-100',
  },
  advanced: {
    label: 'Продвинутый',
    class: 'text-red-700',
    bg: 'bg-gradient-to-r from-red-50 to-red-100',
  },
}

export default function WorkoutTemplates() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [menuOpen, setMenuOpen] = useState<number | null>(null)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await workoutTemplatesApi.list()
      setTemplates(data.results || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Закрытие меню при клике вне
  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null)
    if (menuOpen !== null) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [menuOpen])

  const handleDuplicate = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    await workoutTemplatesApi.duplicate(id)
    loadTemplates()
    setMenuOpen(null)
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (confirm('Удалить шаблон тренировки?')) {
      await workoutTemplatesApi.delete(id)
      loadTemplates()
    }
    setMenuOpen(null)
  }

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
    const matchesDifficulty = !difficultyFilter || t.difficulty === difficultyFilter
    return matchesSearch && matchesDifficulty
  })

  return (
    <div className="min-h-screen">
      <button
        onClick={() => navigate('/workouts')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Назад к тренировкам
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Шаблоны тренировок</h1>
          <p className="text-gray-500 mt-1">
            Создавайте шаблоны для быстрого назначения тренировок клиентам
          </p>
        </div>
        <button
          onClick={() => navigate('/workouts/templates/new')}
          className="flex items-center gap-2 px-5 py-2.5 text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-105"
        >
          <Plus size={18} />
          Новый шаблон
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск шаблонов..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
          />
        </div>
        <div className="relative">
          <Filter
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="pl-12 pr-8 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer transition-all duration-200"
          >
            <option value="">Все уровни</option>
            <option value="beginner">Начинающий</option>
            <option value="intermediate">Средний</option>
            <option value="advanced">Продвинутый</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Dumbbell size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Шаблоны не найдены</h3>
          <p className="text-gray-500 mb-6">
            {search
              ? 'Попробуйте изменить параметры поиска'
              : 'Создайте первый шаблон тренировки'}
          </p>
          {!search && (
            <button
              onClick={() => navigate('/workouts/templates/new')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Создать шаблон
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => navigate(`/workouts/templates/${template.id}`)}
              onMouseEnter={() => setHoveredCard(template.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className={`
                relative bg-white rounded-2xl border border-gray-200 overflow-hidden
                cursor-pointer transition-all duration-300
                ${hoveredCard === template.id ? 'shadow-xl scale-[1.02] border-blue-200' : 'shadow-sm hover:shadow-md'}
              `}
            >
              {/* Верхняя полоска с цветом сложности */}
              <div className={`h-1 ${difficultyConfig[template.difficulty]?.bg}`} />

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                      {template.name}
                    </h3>
                    <span
                      className={`inline-block text-xs font-medium mt-1 ${difficultyConfig[template.difficulty]?.class}`}
                    >
                      {difficultyConfig[template.difficulty]?.label}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(menuOpen === template.id ? null : template.id)
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {menuOpen === template.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-10 py-2 min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/workouts/templates/${template.id}`)
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <Edit size={16} className="text-gray-400" />
                          Редактировать
                        </button>
                        <button
                          onClick={(e) => handleDuplicate(e, template.id)}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <Copy size={16} className="text-gray-400" />
                          Дублировать
                        </button>
                        <hr className="my-2 border-gray-100" />
                        <button
                          onClick={(e) => handleDelete(e, template.id)}
                          className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                        >
                          <Trash2 size={16} />
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {template.description && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {template.description}
                  </p>
                )}

                {/* Теги */}
                {template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span className="px-2.5 py-1 text-gray-400 text-xs">
                        +{template.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Статистика */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Layers size={16} />
                    <span className="text-sm">{template.blocks_count} блоков</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Dumbbell size={16} />
                    <span className="text-sm">{template.exercises_count} упр.</span>
                  </div>
                  {template.estimated_duration && (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Clock size={16} />
                      <span className="text-sm">{template.estimated_duration} мин</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
