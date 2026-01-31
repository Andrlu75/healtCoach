import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getNutritionProgramToday,
  getNutritionProgramMealReports,
  createMealReport,
  getMealReportPhoto,
} from '../../api/endpoints'
import { Card, CardContent } from '../../shared/components/ui'
import { Skeleton } from '../../shared/components/feedback'

interface Meal {
  type: string
  time: string
  name: string
  description: string
}

interface MealReport {
  id: number
  meal_type: string
  is_compliant: boolean
  compliance_score: number
  photo_url?: string
  photo_file_id?: string
  ai_analysis?: string
}

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  snack1: '🍎',
  lunch: '🍽️',
  snack2: '🥜',
  dinner: '🌙',
}

const MEAL_COLORS: Record<string, { bg: string; border: string }> = {
  breakfast: { bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800' },
  snack1: { bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-800' },
  lunch: { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800' },
  snack2: { bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800' },
  dinner: { bg: 'bg-indigo-50 dark:bg-indigo-900/10', border: 'border-indigo-200 dark:border-indigo-800' },
}

function MealReportImage({ report }: { report: MealReport }) {
  const { data: photoUrl, isLoading } = useQuery({
    queryKey: ['mealReportPhoto', report.id],
    queryFn: async () => {
      // Если есть photo_url, используем его напрямую
      if (report.photo_url) {
        return report.photo_url
      }
      // Иначе загружаем через API
      const response = await getMealReportPhoto(report.id)
      return URL.createObjectURL(response.data)
    },
    enabled: !!(report.photo_url || report.photo_file_id),
    staleTime: 5 * 60 * 1000, // 5 минут кэша
  })

  if (isLoading) {
    return (
      <div className="w-full h-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt="Фото еды"
        className="w-full h-24 object-cover rounded-lg"
      />
    )
  }

  return (
    <div className="w-full h-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
      <span className="text-gray-400">Фото недоступно</span>
    </div>
  )
}

function MealCard({
  meal,
  reports,
  isUploading,
  onPhotoClick,
}: {
  meal: Meal
  reports: MealReport[]
  isUploading?: boolean
  onPhotoClick: (mealType: string) => void
}) {
  const colors = MEAL_COLORS[meal.type] || MEAL_COLORS.lunch
  const icon = MEAL_ICONS[meal.type] || '🍽️'

  // Вычисляем общий статус по всем отчётам
  const hasReports = reports.length > 0
  const avgScore = hasReports
    ? Math.round(reports.reduce((sum, r) => sum + r.compliance_score, 0) / reports.length)
    : 0
  const allCompliant = hasReports && reports.every((r) => r.is_compliant)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {meal.name}
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {meal.time}
              </span>
            </div>
          </div>
          {hasReports && (
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              allCompliant
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            }`}>
              {allCompliant ? '✓' : '!'} {avgScore}%
            </div>
          )}
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {meal.description}
        </p>

        {/* Photo section */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {isUploading && (
            <div className="w-full py-4 flex flex-col items-center justify-center gap-2 mb-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Анализируем фото...
              </span>
            </div>
          )}

          {/* Показываем все загруженные фото */}
          {reports.length > 0 && (
            <div className="space-y-3 mb-3">
              {reports.map((report) => (
                <div key={report.id} className="relative">
                  <MealReportImage report={report} />
                  {report.ai_analysis && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                      {report.ai_analysis}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Кнопка добавления фото (всегда видна) */}
          {!isUploading && (
            <button
              onClick={() => onPhotoClick(meal.type)}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-lg">📷</span>
              {reports.length > 0 ? 'Добавить ещё фото' : 'Добавить фото'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function NutritionProgram() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNotes, setShowNotes] = useState(false)
  const [uploadingMealType, setUploadingMealType] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentMealTypeRef = useRef<string>('')

  const { data: todayData, isLoading, isError, refetch } = useQuery({
    queryKey: ['nutritionProgramToday'],
    queryFn: async () => {
      const { data } = await getNutritionProgramToday()
      return data
    },
  })

  const { data: reportsData, refetch: refetchReports } = useQuery({
    queryKey: ['nutritionProgramMealReports'],
    queryFn: async () => {
      const { data } = await getNutritionProgramMealReports()
      return data
    },
    enabled: !!todayData?.has_program,
  })

  const uploadMutation = useMutation({
    mutationFn: createMealReport,
    onSuccess: () => {
      refetchReports()
      queryClient.invalidateQueries({ queryKey: ['nutritionProgramMealReports'] })
    },
    onSettled: () => {
      setUploadingMealType(null)
    },
  })

  const handlePhotoClick = (mealType: string) => {
    currentMealTypeRef.current = mealType
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const mealType = currentMealTypeRef.current
    setUploadingMealType(mealType)

    // Convert file to base64
    const reader = new FileReader()
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1]

        await uploadMutation.mutateAsync({
          meal_type: mealType,
          photo_base64: base64,
        })
      } catch (error) {
        console.error('Failed to upload photo:', error)
        setUploadingMealType(null)
      }
    }
    reader.onerror = () => {
      console.error('Failed to read file')
      setUploadingMealType(null)
    }
    reader.readAsDataURL(file)

    // Reset input
    e.target.value = ''
  }

  if (isError) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Не удалось загрузить данные
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Проверьте подключение к интернету
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 active:bg-blue-700"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!todayData?.has_program) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-3xl">🥗</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Нет активной программы
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ваш коуч ещё не назначил программу питания
          </p>
        </div>
      </div>
    )
  }

  const progress = Math.round((todayData.day_number / todayData.total_days) * 100)
  const meals: Meal[] = todayData.meals || []
  const reports: MealReport[] = reportsData?.reports || []

  // Create a map of reports by meal type (array of reports for each type)
  const reportsByType: Record<string, MealReport[]> = {}
  reports.forEach((r) => {
    if (!reportsByType[r.meal_type]) {
      reportsByType[r.meal_type] = []
    }
    reportsByType[r.meal_type].push(r)
  })

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Hidden file input - без capture чтобы показать выбор: камера или галерея */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Программа питания
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          День {todayData.day_number} из {todayData.total_days} • {todayData.program_name}
        </p>
      </div>

      {/* Progress bar */}
      <Card variant="elevated">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Прогресс программы</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {progress}%
            </span>
          </div>
          <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Activity recommendation */}
      {todayData.activity && (
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <span className="text-lg">🏃</span>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Активность на сегодня</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {todayData.activity}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meals */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-1">
          Меню на сегодня
        </h2>
        {meals.length > 0 ? (
          meals.map((meal, index) => (
            <MealCard
              key={`${meal.type}-${index}`}
              meal={meal}
              reports={reportsByType[meal.type] || []}
              isUploading={uploadingMealType === meal.type}
              onPhotoClick={handlePhotoClick}
            />
          ))
        ) : (
          <Card variant="elevated">
            <CardContent className="p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                Меню на сегодня пока не заполнено
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* General notes */}
      {todayData.general_notes && (
        <Card variant="elevated">
          <CardContent className="p-4">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="w-full flex items-center justify-between"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span>📋</span> Общие рекомендации
              </span>
              <motion.span
                animate={{ rotate: showNotes ? 180 : 0 }}
                className="text-gray-400"
              >
                ▼
              </motion.span>
            </button>
            <AnimatePresence>
              {showNotes && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {todayData.general_notes}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}

      {/* Day notes */}
      {todayData.notes && (
        <Card variant="elevated">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <span>💡</span> Заметка на день
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{todayData.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* History link */}
      <button
        onClick={() => navigate('/nutrition/history')}
        className="w-full py-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center justify-center gap-1"
      >
        История программы <span>→</span>
      </button>
    </div>
  )
}

export default NutritionProgram
