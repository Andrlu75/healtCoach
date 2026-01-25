import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Camera, X, Image } from 'lucide-react'
import { addMealWithPhoto } from '../../api/endpoints'
import { useTelegram, useHaptic } from '../../shared/hooks'
import { Button, Input, Card } from '../../shared/components/ui'
import { cn } from '../../shared/lib/cn'

interface MealFormData {
  dish_name: string
  dish_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories?: string
  proteins?: string
  fats?: string
  carbohydrates?: string
  photo?: File
}

const dishTypes = [
  { value: 'breakfast', label: 'Завтрак', icon: '🍳' },
  { value: 'lunch', label: 'Обед', icon: '🍲' },
  { value: 'dinner', label: 'Ужин', icon: '🍽️' },
  { value: 'snack', label: 'Перекус', icon: '🍎' },
] as const

function AddMeal() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showBackButton, hideBackButton } = useTelegram()
  const { impact, notification } = useHaptic()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MealFormData>({
    defaultValues: {
      dish_type: 'lunch',
      dish_name: '',
    },
  })

  const selectedType = watch('dish_type')

  const handleCameraClick = () => {
    impact('light')
    cameraInputRef.current?.click()
  }

  const handleGalleryClick = () => {
    impact('light')
    galleryInputRef.current?.click()
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
      notification('success')
    }
  }

  const handleRemovePhoto = () => {
    impact('light')
    setPhotoFile(null)
    setPhotoPreview(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  useEffect(() => {
    showBackButton(() => {
      navigate(-1)
    })
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, navigate])

  const mutation = useMutation({
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

  const onSubmit = (data: MealFormData) => {
    impact('light')
    const formData = new FormData()
    formData.append('dish_name', data.dish_name)
    formData.append('dish_type', data.dish_type)
    if (data.calories) formData.append('calories', data.calories)
    if (data.proteins) formData.append('proteins', data.proteins)
    if (data.fats) formData.append('fats', data.fats)
    if (data.carbohydrates) formData.append('carbohydrates', data.carbohydrates)
    if (photoFile) formData.append('image', photoFile)

    mutation.mutate(formData)
  }

  const handleTypeSelect = (type: typeof dishTypes[number]['value']) => {
    impact('light')
    setValue('dish_type', type)
  }

  return (
    <div className="p-4 pb-8">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
        Добавить приём пищи
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        <Card variant="elevated" className="p-4 space-y-4">
          <Input
            label="Название блюда"
            placeholder="Например: Овсянка с ягодами"
            error={errors.dish_name?.message}
            {...register('dish_name', { required: 'Введите название блюда' })}
          />

          {/* Инпут для камеры */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          {/* Инпут для галереи */}
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
                className="w-full h-48 object-cover rounded-xl"
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
                className="h-20 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-500 dark:text-gray-400 active:bg-gray-50 dark:active:bg-gray-800"
              >
                <Camera size={24} />
                <span className="text-xs">Камера</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={handleGalleryClick}
                className="h-20 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-500 dark:text-gray-400 active:bg-gray-50 dark:active:bg-gray-800"
              >
                <Image size={24} />
                <span className="text-xs">Галерея</span>
              </motion.button>
            </div>
          )}
        </Card>

        <Card variant="elevated" className="p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Пищевая ценность (опционально)
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
          isLoading={isSubmitting || mutation.isPending}
        >
          Сохранить
        </Button>
      </form>
    </div>
  )
}

export default AddMeal
