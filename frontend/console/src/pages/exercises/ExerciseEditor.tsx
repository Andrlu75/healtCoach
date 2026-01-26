import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, X, Plus, Trash2 } from 'lucide-react'
import { exercisesApi, exerciseCategoriesApi, exerciseTypesApi } from '../../api/exercises'
import type { ExerciseCategory, ExerciseType } from '../../types'

export default function ExerciseEditor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = id && id !== 'new'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<ExerciseCategory[]>([])
  const [types, setTypes] = useState<ExerciseType[]>([])
  const [selectedType, setSelectedType] = useState<ExerciseType | null>(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    instructions: [] as string[],
    category: '' as number | '',
    exercise_type: '' as number | '',
    video_url: '',
    media_type: 'image' as 'image' | 'video',
    default_parameters: {} as Record<string, number>,
    muscle_groups: [] as string[],
    equipment: [] as string[],
    difficulty: 'intermediate' as 'beginner' | 'intermediate' | 'advanced',
    is_active: true,
  })
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [newInstruction, setNewInstruction] = useState('')
  const [newMuscle, setNewMuscle] = useState('')
  const [newEquipment, setNewEquipment] = useState('')

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    if (form.exercise_type) {
      const type = types.find((t) => t.id === form.exercise_type)
      setSelectedType(type || null)
    } else {
      setSelectedType(null)
    }
  }, [form.exercise_type, types])

  const loadData = async () => {
    setLoading(true)
    try {
      const [categoriesRes, typesRes] = await Promise.all([
        exerciseCategoriesApi.list(),
        exerciseTypesApi.list(),
      ])
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

      if (isEdit) {
        const { data } = await exercisesApi.get(Number(id))
        setForm({
          name: data.name,
          description: data.description,
          instructions: data.instructions || [],
          category: data.category || '',
          exercise_type: data.exercise_type || '',
          video_url: data.video_url,
          media_type: data.media_type,
          default_parameters: data.default_parameters || {},
          muscle_groups: data.muscle_groups || [],
          equipment: data.equipment || [],
          difficulty: data.difficulty,
          is_active: data.is_active,
        })
        if (data.image) {
          setImagePreview(data.image)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('description', form.description)
      formData.append('instructions', JSON.stringify(form.instructions))
      if (form.category) formData.append('category', String(form.category))
      if (form.exercise_type) formData.append('exercise_type', String(form.exercise_type))
      formData.append('video_url', form.video_url)
      formData.append('media_type', form.media_type)
      formData.append('default_parameters', JSON.stringify(form.default_parameters))
      formData.append('muscle_groups', JSON.stringify(form.muscle_groups))
      formData.append('equipment', JSON.stringify(form.equipment))
      formData.append('difficulty', form.difficulty)
      formData.append('is_active', String(form.is_active))

      if (image) {
        formData.append('image', image)
      }

      if (isEdit) {
        await exercisesApi.update(Number(id), formData)
      } else {
        await exercisesApi.create(formData)
      }

      navigate('/exercises')
    } finally {
      setSaving(false)
    }
  }

  const addInstruction = () => {
    if (newInstruction.trim()) {
      setForm({ ...form, instructions: [...form.instructions, newInstruction.trim()] })
      setNewInstruction('')
    }
  }

  const removeInstruction = (index: number) => {
    setForm({
      ...form,
      instructions: form.instructions.filter((_, i) => i !== index),
    })
  }

  const addMuscle = () => {
    if (newMuscle.trim() && !form.muscle_groups.includes(newMuscle.trim())) {
      setForm({ ...form, muscle_groups: [...form.muscle_groups, newMuscle.trim()] })
      setNewMuscle('')
    }
  }

  const addEquipment = () => {
    if (newEquipment.trim() && !form.equipment.includes(newEquipment.trim())) {
      setForm({ ...form, equipment: [...form.equipment, newEquipment.trim()] })
      setNewEquipment('')
    }
  }

  if (loading) {
    return <div className="text-gray-500">Загрузка...</div>
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

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? 'Редактирование упражнения' : 'Новое упражнение'}
      </h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Основная информация */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-medium text-gray-900">Основная информация</h2>

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
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value ? Number(e.target.value) : '' })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Без категории</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
              <select
                value={form.exercise_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    exercise_type: e.target.value ? Number(e.target.value) : '',
                    default_parameters: {},
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Выберите тип</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Сложность</label>
            <select
              value={form.difficulty}
              onChange={(e) =>
                setForm({
                  ...form,
                  difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="beginner">Начинающий</option>
              <option value="intermediate">Средний</option>
              <option value="advanced">Продвинутый</option>
            </select>
          </div>
        </div>

        {/* Медиа */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-medium text-gray-900">Медиа</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип медиа</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="image"
                  checked={form.media_type === 'image'}
                  onChange={() => setForm({ ...form, media_type: 'image' })}
                />
                Изображение
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="video"
                  checked={form.media_type === 'video'}
                  onChange={() => setForm({ ...form, media_type: 'video' })}
                />
                Видео
              </label>
            </div>
          </div>

          {form.media_type === 'image' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Изображение</label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-40 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null)
                      setImagePreview(null)
                    }}
                    className="absolute top-2 right-2 p-1 bg-white rounded-full shadow"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500">
                  <Upload size={24} className="text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Загрузить изображение</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ссылка на видео
              </label>
              <input
                type="url"
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://youtube.com/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}
        </div>

        {/* Параметры по умолчанию */}
        {selectedType && selectedType.parameters.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-medium text-gray-900">Параметры по умолчанию</h2>
            <div className="grid grid-cols-2 gap-4">
              {selectedType.parameters_display.map((param) => (
                <div key={param.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {param.label}
                  </label>
                  <input
                    type="number"
                    value={form.default_parameters[param.key] || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        default_parameters: {
                          ...form.default_parameters,
                          [param.key]: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Инструкция */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-medium text-gray-900">Инструкция по выполнению</h2>
          <div className="space-y-2">
            {form.instructions.map((instruction, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                <span className="flex-1 text-sm">{instruction}</span>
                <button
                  type="button"
                  onClick={() => removeInstruction(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
              placeholder="Добавить шаг..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addInstruction()
                }
              }}
            />
            <button
              type="button"
              onClick={addInstruction}
              className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Дополнительно */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-medium text-gray-900">Дополнительно</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Группы мышц</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.muscle_groups.map((muscle) => (
                <span
                  key={muscle}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                >
                  {muscle}
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        muscle_groups: form.muscle_groups.filter((m) => m !== muscle),
                      })
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMuscle}
                onChange={(e) => setNewMuscle(e.target.value)}
                placeholder="Например: квадрицепс"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addMuscle()
                  }
                }}
              />
              <button
                type="button"
                onClick={addMuscle}
                className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Оборудование</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.equipment.map((eq) => (
                <span
                  key={eq}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                >
                  {eq}
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        equipment: form.equipment.filter((e) => e !== eq),
                      })
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newEquipment}
                onChange={(e) => setNewEquipment(e.target.value)}
                placeholder="Например: гантели"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addEquipment()
                  }
                }}
              />
              <button
                type="button"
                onClick={addEquipment}
                className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Активно</span>
          </label>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate('/exercises')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}
