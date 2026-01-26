import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { exerciseTypesApi } from '../../api/exercises'
import type { ExerciseType } from '../../types'

const PARAMETER_OPTIONS = [
  { key: 'sets', label: 'Подходы' },
  { key: 'reps', label: 'Повторения' },
  { key: 'weight', label: 'Вес (кг)' },
  { key: 'duration', label: 'Время (сек)' },
  { key: 'distance', label: 'Дистанция (м)' },
  { key: 'calories', label: 'Калории' },
  { key: 'pace', label: 'Темп' },
  { key: 'heart_rate', label: 'Пульс' },
]

export default function ExerciseTypes() {
  const navigate = useNavigate()
  const [types, setTypes] = useState<ExerciseType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    parameters: [] as string[],
  })

  useEffect(() => {
    loadTypes()
  }, [])

  const loadTypes = async () => {
    setLoading(true)
    try {
      const { data } = await exerciseTypesApi.list()
      const d = data as ExerciseType[] | { results: ExerciseType[] }
      setTypes(Array.isArray(d) ? d : d.results || [])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      await exerciseTypesApi.update(editingId, form)
    } else {
      await exerciseTypesApi.create(form)
    }
    setForm({ name: '', description: '', parameters: [] })
    setEditingId(null)
    loadTypes()
  }

  const handleEdit = (type: ExerciseType) => {
    setEditingId(type.id)
    setForm({
      name: type.name,
      description: type.description,
      parameters: type.parameters,
    })
  }

  const handleDelete = async (id: number) => {
    if (confirm('Удалить тип упражнения?')) {
      await exerciseTypesApi.delete(id)
      loadTypes()
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setForm({ name: '', description: '', parameters: [] })
  }

  const toggleParameter = (key: string) => {
    if (form.parameters.includes(key)) {
      setForm({
        ...form,
        parameters: form.parameters.filter((p) => p !== key),
      })
    } else {
      setForm({
        ...form,
        parameters: [...form.parameters, key],
      })
    }
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

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Типы упражнений</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Форма */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-medium text-gray-900 mb-4">
            {editingId ? 'Редактирование типа' : 'Новый тип'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Например: Силовое"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Параметры</label>
              <div className="flex flex-wrap gap-2">
                {PARAMETER_OPTIONS.map((param) => (
                  <button
                    key={param.key}
                    type="button"
                    onClick={() => toggleParameter(param.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      form.parameters.includes(param.key)
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {param.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Выберите параметры, которые будут использоваться для этого типа упражнений
              </p>
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
                disabled={form.parameters.length === 0}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editingId ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </form>
        </div>

        {/* Список */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-medium text-gray-900 mb-4">Список типов</h2>
          {loading ? (
            <div className="text-gray-500">Загрузка...</div>
          ) : types.length === 0 ? (
            <div className="text-gray-500 text-center py-8">Типы не созданы</div>
          ) : (
            <div className="space-y-2">
              {types.map((type) => (
                <div
                  key={type.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{type.name}</div>
                      {type.description && (
                        <div className="text-sm text-gray-500 mt-1">{type.description}</div>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {type.parameters_display.map((param) => (
                          <span
                            key={param.key}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                          >
                            {param.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(type)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(type.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
