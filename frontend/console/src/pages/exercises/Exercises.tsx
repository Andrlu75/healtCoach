import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, MoreVertical, Copy, Trash2, Edit } from 'lucide-react'
import { exercisesApi, exerciseCategoriesApi, exerciseTypesApi } from '../../api/exercises'
import type { Exercise, ExerciseCategory, ExerciseType } from '../../types'

const difficultyLabels: Record<string, { label: string; class: string }> = {
  beginner: { label: 'Начинающий', class: 'bg-green-100 text-green-700' },
  intermediate: { label: 'Средний', class: 'bg-yellow-100 text-yellow-700' },
  advanced: { label: 'Продвинутый', class: 'bg-red-100 text-red-700' },
}

export default function Exercises() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [categories, setCategories] = useState<ExerciseCategory[]>([])
  const [types, setTypes] = useState<ExerciseType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('')
  const [typeFilter, setTypeFilter] = useState<number | ''>('')
  const [menuOpen, setMenuOpen] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadExercises()
  }, [categoryFilter, typeFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [categoriesRes, typesRes] = await Promise.all([
        exerciseCategoriesApi.list(),
        exerciseTypesApi.list(),
      ])
      // API может вернуть массив или объект с results
      const catData = categoriesRes.data as ExerciseCategory[] | { results: ExerciseCategory[] }
      const categoriesData = Array.isArray(catData)
        ? catData
        : catData.results || []
      const typeData = typesRes.data as ExerciseType[] | { results: ExerciseType[] }
      const typesData = Array.isArray(typeData)
        ? typeData
        : typeData.results || []
      setCategories(categoriesData)
      setTypes(typesData)
      await loadExercises()
    } finally {
      setLoading(false)
    }
  }

  const loadExercises = async () => {
    const { data } = await exercisesApi.list({
      category: categoryFilter || undefined,
      exercise_type: typeFilter || undefined,
      search: search || undefined,
    })
    setExercises(data.results || [])
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadExercises()
  }

  const handleDuplicate = async (id: number) => {
    await exercisesApi.duplicate(id)
    loadExercises()
    setMenuOpen(null)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Удалить упражнение?')) {
      await exercisesApi.delete(id)
      loadExercises()
    }
    setMenuOpen(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">База упражнений</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/exercises/categories')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Категории
          </button>
          <button
            onClick={() => navigate('/exercises/types')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Типы
          </button>
          <button
            onClick={() => navigate('/exercises/new')}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            Добавить
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </form>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Все категории</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Все типы</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500">Загрузка...</div>
      ) : exercises.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          <p className="mb-4">Упражнения не найдены</p>
          <button
            onClick={() => navigate('/exercises/new')}
            className="text-blue-600 hover:text-blue-700"
          >
            Создать первое упражнение
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/exercises/${exercise.id}`)}
            >
              {exercise.image && (
                <div className="h-40 bg-gray-100">
                  <img
                    src={exercise.image}
                    alt={exercise.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{exercise.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {exercise.category_name || 'Без категории'}
                      {exercise.type_name && ` • ${exercise.type_name}`}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(menuOpen === exercise.id ? null : exercise.id)
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuOpen === exercise.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/exercises/${exercise.id}`)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Edit size={14} />
                          Редактировать
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDuplicate(exercise.id)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Copy size={14} />
                          Дублировать
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(exercise.id)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 size={14} />
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      difficultyLabels[exercise.difficulty]?.class
                    }`}
                  >
                    {difficultyLabels[exercise.difficulty]?.label}
                  </span>
                  {exercise.equipment.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {exercise.equipment.slice(0, 2).join(', ')}
                    </span>
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
