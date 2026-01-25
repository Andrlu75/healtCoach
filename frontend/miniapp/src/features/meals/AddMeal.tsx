import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Camera } from 'lucide-react'
import { addMeal } from '../../api/endpoints'
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

  useEffect(() => {
    showBackButton(() => {
      navigate(-1)
    })
    return () => hideBackButton()
  }, [showBackButton, hideBackButton, navigate])

  const mutation = useMutation({
    mutationFn: addMeal,
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
    mutation.mutate({
      dish_name: data.dish_name,
      dish_type: data.dish_type,
      calories: data.calories ? Number(data.calories) : undefined,
      proteins: data.proteins ? Number(data.proteins) : undefined,
      fats: data.fats ? Number(data.fats) : undefined,
      carbohydrates: data.carbohydrates ? Number(data.carbohydrates) : undefined,
    })
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

          <button
            type="button"
            className="w-full h-24 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500"
          >
            <Camera size={24} />
            <span className="text-sm">Добавить фото</span>
          </button>
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
