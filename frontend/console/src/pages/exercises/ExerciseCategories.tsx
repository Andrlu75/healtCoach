import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { exerciseCategoriesApi } from '../../api/exercises'
import type { ExerciseCategory } from '../../types'

export default function ExerciseCategories() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<ExerciseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6' })

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    setLoading(true)
    try {
      const { data } = await exerciseCategoriesApi.list()
      const d = data as ExerciseCategory[] | { results: ExerciseCategory[] }
      setCategories(Array.isArray(d) ? d : d.results || [])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      await exerciseCategoriesApi.update(editingId, form)
    } else {
      await exerciseCategoriesApi.create(form)
    }
    setForm({ name: '', description: '', color: '#3B82F6' })
    setEditingId(null)
    loadCategories()
  }

  const handleEdit = (category: ExerciseCategory) => {
    setEditingId(category.id)
    setForm({
      name: category.name,
      description: category.description,
      color: category.color,
    })
  }

  const handleDelete = async (id: number) => {
    if (confirm('Удалить категорию?')) {
      await exerciseCategoriesApi.delete(id)
      loadCategories()
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setForm({ name: '', description: '', color: '#3B82F6' })
  }

  return (
    <div>
      <button
        onClick={() => navigate('/exercises')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={16} />
        Назад к упражнениям
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Категории упражнений</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Форма */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-medium text-gray-900 mb-4">
            {editingId ? 'Редактирование категории' : 'Новая категория'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {editingId ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </form>
        </div>

        {/* Список */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-medium text-gray-900 mb-4">Список категорий</h2>
          {loading ? (
            <div className="text-gray-500">Загрузка...</div>
          ) : categories.length === 0 ? (
            <div className="text-gray-500 text-center py-8">Категории не созданы</div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{category.name}</div>
                    {category.description && (
                      <div className="text-sm text-gray-500">{category.description}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {category.exercises_count} упражнений
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
