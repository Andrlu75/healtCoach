import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Clock,
  Save,
} from 'lucide-react'
import {
  clientWorkoutsApi,
  workoutBlocksApi,
  workoutExercisesApi,
  workoutTemplatesApi,
} from '../../api/workouts'
import { exercisesApi } from '../../api/exercises'
import { clientsApi } from '../../api/clients'
import type { ClientWorkout, Client, Exercise, WorkoutTemplate, WorkoutBlock } from '../../types'

const blockTypeLabels: Record<string, string> = {
  warmup: 'Разминка',
  main: 'Основная часть',
  cooldown: 'Заминка',
  custom: 'Пользовательский',
}

export default function WorkoutBuilder() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const clientIdParam = searchParams.get('client')
  const isEdit = id && id !== 'new'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [workout, setWorkout] = useState<ClientWorkout | null>(null)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set())

  // Форма для создания/редактирования
  const [form, setForm] = useState({
    client: clientIdParam ? Number(clientIdParam) : ('' as number | ''),
    name: '',
    description: '',
    scheduled_date: '',
    scheduled_time: '',
    estimated_duration: '' as number | '',
    difficulty: 'intermediate' as 'beginner' | 'intermediate' | 'advanced',
    notes: '',
    reminder_enabled: true,
    reminder_minutes_before: 60,
  })

  // Модальное окно добавления упражнения
  const [showExerciseModal, setShowExerciseModal] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [exerciseSearch, setExerciseSearch] = useState('')

  // Модальное окно добавления блока
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [newBlock, setNewBlock] = useState({ name: '', block_type: 'main' })

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [clientsRes, templatesRes, exercisesRes] = await Promise.all([
        clientsApi.list({ status: 'active' }),
        workoutTemplatesApi.list(),
        exercisesApi.list(),
      ])
      setClients(clientsRes.data.results || [])
      setTemplates(templatesRes.data.results || [])
      setExercises(exercisesRes.data.results || [])

      if (isEdit) {
        const { data } = await clientWorkoutsApi.get(Number(id))
        setWorkout(data)
        setForm({
          client: data.client,
          name: data.name,
          description: data.description,
          scheduled_date: data.scheduled_date || '',
          scheduled_time: data.scheduled_time || '',
          estimated_duration: data.estimated_duration || '',
          difficulty: data.difficulty,
          notes: data.notes,
          reminder_enabled: data.reminder_enabled,
          reminder_minutes_before: data.reminder_minutes_before,
        })
        // Развернуть все блоки
        if (data.blocks) {
          setExpandedBlocks(new Set(data.blocks.map((b: WorkoutBlock) => b.id)))
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBasicInfo = async () => {
    if (!form.client || !form.name) return

    setSaving(true)
    try {
      const payload = {
        client: form.client as number,
        name: form.name,
        description: form.description,
        scheduled_date: form.scheduled_date || null,
        scheduled_time: form.scheduled_time || null,
        estimated_duration: form.estimated_duration || null,
        difficulty: form.difficulty,
        notes: form.notes,
        reminder_enabled: form.reminder_enabled,
        reminder_minutes_before: form.reminder_minutes_before,
      }
      if (isEdit) {
        const { data } = await clientWorkoutsApi.update(Number(id), payload)
        setWorkout(data)
      } else {
        const { data } = await clientWorkoutsApi.create({
          ...payload,
          status: 'draft',
        })
        navigate(`/workouts/${data.id}`, { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCreateFromTemplate = async (templateId: number) => {
    if (!form.client) {
      alert('Сначала выберите клиента')
      return
    }

    setSaving(true)
    try {
      const { data } = await clientWorkoutsApi.createFromTemplate({
        template_id: templateId,
        client_id: form.client as number,
        scheduled_date: form.scheduled_date || undefined,
        scheduled_time: form.scheduled_time || undefined,
      })
      navigate(`/workouts/${data.id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  const handleAddBlock = async () => {
    if (!workout) return

    await workoutBlocksApi.create({
      workout: workout.id,
      name: newBlock.name || blockTypeLabels[newBlock.block_type],
      block_type: newBlock.block_type,
      order: (workout.blocks?.length || 0) + 1,
    })
    setShowBlockModal(false)
    setNewBlock({ name: '', block_type: 'main' })
    loadData()
  }

  const handleDeleteBlock = async (blockId: number) => {
    if (confirm('Удалить блок?')) {
      await workoutBlocksApi.delete(blockId)
      loadData()
    }
  }

  const handleAddExercise = async (exerciseId: number) => {
    if (!selectedBlockId) return

    const exercise = exercises.find((e) => e.id === exerciseId)
    await workoutBlocksApi.addExercise(selectedBlockId, {
      exercise: exerciseId,
      parameters: exercise?.default_parameters || {},
      rest_after: 60,
    })
    setShowExerciseModal(false)
    setSelectedBlockId(null)
    loadData()
  }

  const handleDeleteExercise = async (exerciseId: number) => {
    await workoutExercisesApi.delete(exerciseId)
    loadData()
  }

  const toggleBlock = (blockId: number) => {
    const newExpanded = new Set(expandedBlocks)
    if (newExpanded.has(blockId)) {
      newExpanded.delete(blockId)
    } else {
      newExpanded.add(blockId)
    }
    setExpandedBlocks(newExpanded)
  }

  const filteredExercises = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
      e.category_name?.toLowerCase().includes(exerciseSearch.toLowerCase())
  )

  if (loading) {
    return <div className="text-gray-500">Загрузка...</div>
  }

  return (
    <div>
      <button
        onClick={() => navigate('/workouts')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={16} />
        Назад к тренировкам
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? 'Редактирование тренировки' : 'Новая тренировка'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основная информация */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-medium text-gray-900">Основная информация</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Клиент</label>
                <select
                  value={form.client}
                  onChange={(e) =>
                    setForm({ ...form, client: e.target.value ? Number(e.target.value) : '' })
                  }
                  disabled={!!isEdit}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                >
                  <option value="">Выберите клиента</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </div>
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

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Время</label>
                <input
                  type="time"
                  value={form.scheduled_time}
                  onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Длительность (мин)
                </label>
                <input
                  type="number"
                  value={form.estimated_duration}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estimated_duration: e.target.value ? Number(e.target.value) : '',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Заметки для клиента
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.reminder_enabled}
                  onChange={(e) => setForm({ ...form, reminder_enabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Напоминание за</span>
                <input
                  type="number"
                  value={form.reminder_minutes_before}
                  onChange={(e) =>
                    setForm({ ...form, reminder_minutes_before: Number(e.target.value) })
                  }
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-sm text-gray-700">мин</span>
              </label>
              <button
                onClick={handleSaveBasicInfo}
                disabled={saving || !form.client || !form.name}
                className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save size={16} />
                {isEdit ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>

          {/* Блоки тренировки */}
          {workout && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Упражнения</h2>
                <button
                  onClick={() => setShowBlockModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Plus size={14} />
                  Добавить блок
                </button>
              </div>

              {workout.blocks?.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                  <p className="mb-4">Добавьте блоки и упражнения</p>
                  <button
                    onClick={() => setShowBlockModal(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Добавить первый блок
                  </button>
                </div>
              ) : (
                workout.blocks?.map((block) => (
                  <div
                    key={block.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
                      onClick={() => toggleBlock(block.id)}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical size={16} className="text-gray-400" />
                        <div>
                          <span className="font-medium text-gray-900">{block.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {blockTypeLabels[block.block_type]}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {block.exercises.length} упражнений
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteBlock(block.id)
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                        {expandedBlocks.has(block.id) ? (
                          <ChevronUp size={16} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-400" />
                        )}
                      </div>
                    </div>

                    {expandedBlocks.has(block.id) && (
                      <div className="p-4 space-y-2">
                        {block.exercises.map((ex) => (
                          <div
                            key={ex.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <GripVertical size={14} className="text-gray-400" />
                            {ex.exercise_detail?.image && (
                              <img
                                src={ex.exercise_detail.image}
                                alt=""
                                className="w-10 h-10 rounded object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900">
                                {ex.exercise_detail?.name}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {Object.entries(ex.parameters).map(([key, value]) => (
                                  <span key={key} className="text-xs text-gray-500">
                                    {key}: {value}
                                  </span>
                                ))}
                                <span className="text-xs text-gray-400">
                                  <Clock size={10} className="inline mr-1" />
                                  отдых {ex.rest_after}с
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteExercise(ex.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setSelectedBlockId(block.id)
                            setShowExerciseModal(true)
                          }}
                          className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-gray-300"
                        >
                          <Plus size={14} className="inline mr-1" />
                          Добавить упражнение
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Боковая панель */}
        <div className="space-y-6">
          {!isEdit && templates.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Создать из шаблона</h3>
              <div className="space-y-2">
                {templates.slice(0, 5).map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleCreateFromTemplate(template.id)}
                    disabled={!form.client}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-50"
                  >
                    {template.name}
                    <span className="text-xs text-gray-400 ml-2">
                      {template.exercises_count} упр.
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно добавления блока */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Добавить блок</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип блока
                </label>
                <select
                  value={newBlock.block_type}
                  onChange={(e) => setNewBlock({ ...newBlock, block_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="warmup">Разминка</option>
                  <option value="main">Основная часть</option>
                  <option value="cooldown">Заминка</option>
                  <option value="custom">Пользовательский</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название (опционально)
                </label>
                <input
                  type="text"
                  value={newBlock.name}
                  onChange={(e) => setNewBlock({ ...newBlock, name: e.target.value })}
                  placeholder={blockTypeLabels[newBlock.block_type]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleAddBlock}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно добавления упражнения */}
      {showExerciseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Добавить упражнение</h3>
            <input
              type="text"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              placeholder="Поиск упражнений..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => handleAddExercise(exercise.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg"
                >
                  {exercise.image && (
                    <img
                      src={exercise.image}
                      alt=""
                      className="w-12 h-12 rounded object-cover"
                    />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{exercise.name}</div>
                    <div className="text-xs text-gray-500">{exercise.category_name}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t">
              <button
                onClick={() => {
                  setShowExerciseModal(false)
                  setSelectedBlockId(null)
                  setExerciseSearch('')
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
