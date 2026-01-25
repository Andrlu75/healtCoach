import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Camera, X, Image, Loader2, ChevronLeft } from 'lucide-react'
import { addMealWithPhoto, analyzeMealPhoto } from '../../api/endpoints'
import { useTelegram, useHaptic } from '../../shared/hooks'
import { Button, Input, Card } from '../../shared/components/ui'
import { cn } from '../../shared/lib/cn'
import { CameraCapture } from './components/CameraCapture'

interface MealFormData {
  dish_name: string
  dish_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories: string
  proteins: string
  fats: string
  carbohydrates: string
}

const dishTypes = [
  { value: 'breakfast', label: 'Завтрак', icon: '🍳' },
  { value: 'lunch', label: 'Обед', icon: '🍲' },
  { value: 'dinner', label: 'Ужин', icon: '🍽️' },
  { value: 'snack', label: 'Перекус', icon: '🍎' },
] as const

type Step = 'photo' | 'analyzing' | 'result'

function AddMeal() {
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
  const [aiResponse, setAiResponse] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MealFormData>({
    defaultValues: {
      dish_type: 'lunch',
      dish_name: '',
      calories: '',
      proteins: '',
      fats: '',
      carbohydrates: '',
    },
  })

  const selectedType = watch('dish_type')

  // Анализ фото
  const analyzeMutation = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const formData = new FormData()
      formData.append('image', file)
      if (caption) formData.append('caption', caption)
      const response = await analyzeMealPhoto(formData)
      return response.data
    },
    onSuccess: (data) => {
      // Заполняем форму результатами
      if (data.dish_name) setValue('dish_name', data.dish_name)
      if (data.dish_type) {
        const typeMap: Record<string, MealFormData['dish_type']> = {
          'завтрак': 'breakfast',
          'обед': 'lunch',
          'ужин': 'dinner',
          'перекус': 'snack',
        }
        const mappedType = typeMap[data.dish_type.toLowerCase()] || 'lunch'
        setValue('dish_type', mappedType)
      }
      if (data.calories) setValue('calories', String(data.calories))
      if (data.proteins) setValue('proteins', String(data.proteins))
      if (data.fats) setValue('fats', String(data.fats))
      if (data.carbohydrates) setValue('carbohydrates', String(data.carbohydrates))

      // Сохраняем текстовый ответ AI
      if (data.ai_response) setAiResponse(data.ai_response)

      setStep('result')
      notification('success')
    },
    onError: (error) => {
      console.error('Failed to analyze photo:', error)
      setAnalyzeError('Не удалось распознать блюдо. Попробуйте ещё раз.')
      setStep('photo')
      notification('error')
    },
  })

  // Сохранение
  const saveMutation = useMutation({
    mutationFn: addMealWithPhoto,
    onSuccess: () => {
      notification('success')
      queryClient.invalidateQueries({ queryKey: ['meals'] })
      queryClient.invalidateQueries({ queryKey: ['dailySummary'] })
      navigate(-1)
    },
    onError: () => {
      notification('error')
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

  const handleBackToPhoto = () => {
    impact('light')
    setStep('photo')
  }

  const handleTypeSelect = (type: typeof dishTypes[number]['value']) => {
    impact('light')
    setValue('dish_type', type)
  }

  const onSubmit = (data: MealFormData) => {
    if (!photoFile) return
    impact('light')

    const formData = new FormData()
    formData.append('dish_name', data.dish_name)
    formData.append('dish_type', data.dish_type)
    if (data.calories) formData.append('calories', data.calories)
    if (data.proteins) formData.append('proteins', data.proteins)
    if (data.fats) formData.append('fats', data.fats)
    if (data.carbohydrates) formData.append('carbohydrates', data.carbohydrates)
    formData.append('image', photoFile)

    saveMutation.mutate(formData)
  }

  useEffect(() => {
    showBackButton(() => {
      if (step === 'result') {
        handleBackToPhoto()
      } else {
        navigate(-1)
      }
    })
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, navigate, step])

  // Шаг 1: Выбор фото и подпись
  if (step === 'photo') {
    return (
      <div className="p-4 pb-8">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Добавить приём пищи
        </h1>

        <div className="space-y-4">
          <Card variant="elevated" className="p-4">
            {/* Скрытый инпут для галереи */}
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
                  className="h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 active:bg-gray-50 dark:active:bg-gray-800"
                >
                  <Camera size={32} />
                  <span className="text-sm">Камера</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGalleryClick}
                  className="h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 active:bg-gray-50 dark:active:bg-gray-800"
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
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Добавьте уточнение, если хотите получить более точный анализ
              </p>
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
            Распознать блюдо
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
  if (step === 'analyzing') {
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
          Анализируем фото...
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Распознаём блюдо и рассчитываем КБЖУ
        </p>
      </div>
    )
  }

  // Шаг 3: Результат
  return (
    <div className="p-4 pb-8">
      <button
        type="button"
        onClick={handleBackToPhoto}
        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mb-4"
      >
        <ChevronLeft size={20} />
        <span className="text-sm">Назад к фото</span>
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Превью фото */}
        {photoPreview && (
          <img
            src={photoPreview}
            alt="Фото блюда"
            className="w-full h-40 object-cover rounded-xl"
          />
        )}

        {/* AI ответ с рекомендациями */}
        {aiResponse && (
          <Card variant="elevated" className="p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                {aiResponse}
              </p>
            </div>
          </Card>
        )}

        {/* Тип приёма */}
        <Card variant="elevated" className="p-4">
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

        {/* Название блюда */}
        <Card variant="elevated" className="p-4">
          <Input
            label="Название блюда"
            placeholder="Например: Овсянка с ягодами"
            error={errors.dish_name?.message}
            {...register('dish_name', { required: 'Введите название блюда' })}
          />
        </Card>

        {/* КБЖУ */}
        <Card variant="elevated" className="p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Пищевая ценность
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Калории"
              type="number"
              placeholder="0"
              {...register('calories')}
            />
            <Input
              label="Белки (г)"
              type="number"
              placeholder="0"
              {...register('proteins')}
            />
            <Input
              label="Жиры (г)"
              type="number"
              placeholder="0"
              {...register('fats')}
            />
            <Input
              label="Углеводы (г)"
              type="number"
              placeholder="0"
              {...register('carbohydrates')}
            />
          </div>
        </Card>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={saveMutation.isPending}
        >
          Сохранить
        </Button>
      </form>
    </div>
  )
}

export default AddMeal

// Re-export for lazy loading
export { CameraCapture }
