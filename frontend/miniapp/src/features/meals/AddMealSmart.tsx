import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, X, Image, Loader2, Plus, Trash2, Check, Edit3, Scale
} from 'lucide-react'
import {
  analyzeSmartMealPhoto,
  confirmMealDraft,
  cancelMealDraft,
  addIngredientToDraft,
  removeIngredientFromDraft,
  updateMealDraft,
  type MealDraft,
} from '../../api/endpoints'
import { useTelegram, useHaptic } from '../../shared/hooks'
import { Button, Input, Card } from '../../shared/components/ui'
import { cn } from '../../shared/lib/cn'
import { CameraCapture } from './components/CameraCapture'

const dishTypes = [
  { value: 'breakfast', label: 'Завтрак', icon: '🍳' },
  { value: 'lunch', label: 'Обед', icon: '🍲' },
  { value: 'dinner', label: 'Ужин', icon: '🍽️' },
  { value: 'snack', label: 'Перекус', icon: '🍎' },
] as const

type Step = 'photo' | 'analyzing' | 'confirm' | 'adding-ingredient' | 'saving'

function AddMealSmart() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showBackButton, hideBackButton } = useTelegram()
  const { impact, notification } = useHaptic()
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('photo')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  // Draft state
  const [draft, setDraft] = useState<MealDraft | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editingWeight, setEditingWeight] = useState(false)
  const [editedWeight, setEditedWeight] = useState('')
  const [newIngredient, setNewIngredient] = useState('')
  const [selectedType, setSelectedType] = useState<string>('lunch')

  // Анализ фото (умный режим)
  const analyzeMutation = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const formData = new FormData()
      formData.append('image', file)
      if (caption) formData.append('caption', caption)
      const response = await analyzeSmartMealPhoto(formData)
      return response.data
    },
    onSuccess: (data) => {
      setDraft(data)
      setEditedName(data.dish_name)
      setEditedWeight(String(data.estimated_weight))
      if (data.dish_type) {
        const typeMap: Record<string, string> = {
          'завтрак': 'breakfast',
          'обед': 'lunch',
          'ужин': 'dinner',
          'перекус': 'snack',
        }
        setSelectedType(typeMap[data.dish_type.toLowerCase()] || 'lunch')
      }
      setStep('confirm')
      notification('success')
    },
    onError: (error) => {
      console.error('Failed to analyze photo:', error)
      setAnalyzeError('Не удалось распознать блюдо. Попробуйте ещё раз.')
      setStep('photo')
      notification('error')
    },
  })

  // Добавление ингредиента
  const addIngredientMutation = useMutation({
    mutationFn: async ({ draftId, name }: { draftId: string; name: string }) => {
      const response = await addIngredientToDraft(draftId, name)
      return response.data
    },
    onSuccess: (data) => {
      setDraft(data.draft)
      setNewIngredient('')
      setStep('confirm')
      notification('success')
    },
    onError: () => {
      notification('error')
      setStep('confirm')
    },
  })

  // Удаление ингредиента
  const removeIngredientMutation = useMutation({
    mutationFn: async ({ draftId, index }: { draftId: string; index: number }) => {
      const response = await removeIngredientFromDraft(draftId, index)
      return response.data
    },
    onSuccess: (data) => {
      setDraft(data.draft)
      notification('success')
    },
    onError: () => {
      notification('error')
    },
  })

  // Обновление черновика
  const updateDraftMutation = useMutation({
    mutationFn: async ({ draftId, data }: { draftId: string; data: Parameters<typeof updateMealDraft>[1] }) => {
      const response = await updateMealDraft(draftId, data)
      return response.data
    },
    onSuccess: (data) => {
      setDraft(data)
      setEditingName(false)
      setEditingWeight(false)
    },
  })

  // Подтверждение
  const confirmMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const response = await confirmMealDraft(draftId)
      return response.data
    },
    onSuccess: () => {
      notification('success')
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['dailySummary'] })
      navigate(-1)
    },
    onError: () => {
      notification('error')
      setStep('confirm')
    },
  })

  // Отмена
  const cancelMutation = useMutation({
    mutationFn: cancelMealDraft,
    onSuccess: () => {
      navigate(-1)
    },
  })

  const handleCameraClick = () => {
    impact('light')
    setIsCameraOpen(true)
  }

  const handleGalleryClick = () => {
    impact('light')
    galleryInputRef.current?.click()
  }

  const handleCameraCapture = (file: File) => {
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    setAnalyzeError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setAnalyzeError(null)
    }
  }

  const handleRemovePhoto = () => {
    impact('light')
    setPhotoFile(null)
    setPhotoPreview(null)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  const handleAnalyze = () => {
    if (!photoFile) return
    impact('light')
    setStep('analyzing')
    analyzeMutation.mutate({ file: photoFile, caption })
  }

  const handleSaveName = () => {
    if (!draft || !editedName.trim()) return
    updateDraftMutation.mutate({
      draftId: draft.id,
      data: { dish_name: editedName.trim() }
    })
  }

  const handleSaveWeight = () => {
    if (!draft) return
    const weight = parseInt(editedWeight, 10)
    if (isNaN(weight) || weight <= 0) return
    updateDraftMutation.mutate({
      draftId: draft.id,
      data: { estimated_weight: weight }
    })
  }

  const handleAddIngredient = () => {
    if (!draft || !newIngredient.trim()) return
    impact('light')
    setStep('adding-ingredient')
    addIngredientMutation.mutate({ draftId: draft.id, name: newIngredient.trim() })
  }

  const handleRemoveIngredient = (index: number) => {
    if (!draft) return
    impact('light')
    removeIngredientMutation.mutate({ draftId: draft.id, index })
  }

  const handleConfirm = () => {
    if (!draft) return
    impact('medium')
    setStep('saving')
    // Сначала обновим тип приёма пищи если он изменился
    const dishTypeRu = dishTypes.find(t => t.value === selectedType)?.label.toLowerCase() || 'обед'
    if (draft.dish_type.toLowerCase() !== dishTypeRu) {
      updateDraftMutation.mutate({ draftId: draft.id, data: { dish_type: dishTypeRu } }, {
        onSuccess: () => {
          confirmMutation.mutate(draft.id)
        }
      })
    } else {
      confirmMutation.mutate(draft.id)
    }
  }

  const handleCancel = () => {
    if (draft) {
      cancelMutation.mutate(draft.id)
    } else {
      navigate(-1)
    }
  }

  const handleTypeSelect = (type: string) => {
    impact('light')
    setSelectedType(type)
  }

  useEffect(() => {
    showBackButton(() => {
      if (step === 'confirm') {
        handleCancel()
      } else {
        navigate(-1)
      }
    })
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, navigate, step, draft])

  // Шаг 1: Выбор фото
  if (step === 'photo') {
    return (
      <div className="p-4 pb-8">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
          Умный режим
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Детальный анализ с возможностью редактирования
        </p>

        <div className="space-y-4">
          <Card variant="elevated" className="p-4">
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Фото блюда"
                  className="w-full h-56 object-cover rounded-xl"
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
                >
                  <X size={16} className="text-white" />
                </motion.button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCameraClick}
                  className="h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400"
                >
                  <Camera size={32} />
                  <span className="text-sm">Камера</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGalleryClick}
                  className="h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400"
                >
                  <Image size={32} />
                  <span className="text-sm">Галерея</span>
                </motion.button>
              </div>
            )}
          </Card>

          {photoPreview && (
            <Card variant="elevated" className="p-4">
              <Input
                label="Уточнение (необязательно)"
                placeholder="Например: порция 300г, без соуса"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </Card>
          )}

          {analyzeError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{analyzeError}</p>
            </div>
          )}

          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={!photoFile}
            onClick={handleAnalyze}
          >
            Анализировать
          </Button>
        </div>

        <CameraCapture
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
        />
      </div>
    )
  }

  // Шаг 2: Анализ
  if (step === 'analyzing' || step === 'adding-ingredient') {
    const isAddingIngredient = step === 'adding-ingredient'
    return (
      <div className="p-4 pb-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-6">
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Фото блюда"
              className="w-40 h-40 object-cover rounded-2xl opacity-50"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={48} className="text-blue-600 animate-spin" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {isAddingIngredient ? 'Добавляем ингредиент...' : 'Анализируем фото...'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {isAddingIngredient
            ? 'Рассчитываем КБЖУ для ингредиента'
            : 'Детальный анализ ингредиентов'}
        </p>
      </div>
    )
  }

  // Шаг 3: Сохранение
  if (step === 'saving') {
    return (
      <div className="p-4 pb-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={48} className="text-green-600 animate-spin mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Сохраняем...
        </h2>
      </div>
    )
  }

  // Шаг 4: Подтверждение
  if (!draft) return null

  return (
    <div className="p-4 pb-8">
      {/* Header с фото и названием */}
      <div className="relative mb-4">
        {photoPreview && (
          <img
            src={photoPreview}
            alt="Фото блюда"
            className="w-full h-40 object-cover rounded-xl"
          />
        )}

        {/* Confidence badge */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded-full">
          <span className="text-xs text-white">
            {Math.round(draft.ai_confidence * 100)}% уверенность
          </span>
        </div>
      </div>

      {/* Название блюда */}
      <Card variant="elevated" className="p-4 mb-4">
        {editingName ? (
          <div className="flex gap-2">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button size="sm" onClick={handleSaveName} disabled={updateDraftMutation.isPending}>
              <Check size={16} />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditingName(false)}>
              <X size={16} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {draft.dish_name}
            </h2>
            <button onClick={() => setEditingName(true)} className="p-2 text-gray-400">
              <Edit3 size={18} />
            </button>
          </div>
        )}

        {/* Вес порции */}
        <div className="flex items-center gap-2 mt-2">
          <Scale size={16} className="text-gray-400" />
          {editingWeight ? (
            <div className="flex gap-2 flex-1">
              <Input
                type="number"
                value={editedWeight}
                onChange={(e) => setEditedWeight(e.target.value)}
                className="w-24"
                autoFocus
              />
              <span className="text-gray-500 self-center">г</span>
              <Button size="sm" onClick={handleSaveWeight} disabled={updateDraftMutation.isPending}>
                <Check size={16} />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditingWeight(false)}>
                <X size={16} />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingWeight(true)}
              className="flex items-center gap-1 text-gray-600 dark:text-gray-400"
            >
              <span>~{draft.estimated_weight}г</span>
              <Edit3 size={14} />
            </button>
          )}
        </div>
      </Card>

      {/* КБЖУ итого */}
      <Card variant="elevated" className="p-4 mb-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-orange-600">{Math.round(draft.calories)}</div>
            <div className="text-xs text-gray-500">ккал</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600">{Math.round(draft.proteins)}</div>
            <div className="text-xs text-gray-500">белки</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-600">{Math.round(draft.fats)}</div>
            <div className="text-xs text-gray-500">жиры</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{Math.round(draft.carbohydrates)}</div>
            <div className="text-xs text-gray-500">углев.</div>
          </div>
        </div>
      </Card>

      {/* Ингредиенты */}
      <Card variant="elevated" className="p-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Ингредиенты
        </h3>

        <div className="space-y-2">
          <AnimatePresence>
            {draft.ingredients.map((ing, index) => (
              <motion.div
                key={`${ing.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {ing.name}
                    </span>
                    <span className="text-sm text-gray-500">{ing.weight}г</span>
                    {!ing.is_ai_detected && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded">
                        добавлено
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round(ing.calories)} ккал • Б:{Math.round(ing.proteins)} Ж:{Math.round(ing.fats)} У:{Math.round(ing.carbs)}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveIngredient(index)}
                  disabled={removeIngredientMutation.isPending}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Добавить ингредиент */}
        <div className="flex gap-2 mt-3">
          <Input
            placeholder="Добавить ингредиент..."
            value={newIngredient}
            onChange={(e) => setNewIngredient(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddIngredient}
            disabled={!newIngredient.trim() || addIngredientMutation.isPending}
          >
            <Plus size={18} />
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          AI автоматически рассчитает вес и КБЖУ
        </p>
      </Card>

      {/* Тип приёма */}
      <Card variant="elevated" className="p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Тип приёма
        </label>
        <div className="grid grid-cols-4 gap-2">
          {dishTypes.map(({ value, label, icon }) => (
            <motion.button
              key={value}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTypeSelect(value)}
              className={cn(
                'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors',
                selectedType === value
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              )}
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {label}
              </span>
            </motion.button>
          ))}
        </div>
      </Card>

      {/* Кнопки */}
      <div className="space-y-2">
        <Button
          className="w-full"
          size="lg"
          onClick={handleConfirm}
          isLoading={confirmMutation.isPending}
        >
          <Check size={20} className="mr-2" />
          Сохранить
        </Button>
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          onClick={handleCancel}
          disabled={cancelMutation.isPending}
        >
          Отмена
        </Button>
      </div>
    </div>
  )
}

export default AddMealSmart
