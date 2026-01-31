import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import {
  getNutritionProgramToday,
  getNutritionProgramMealReports,
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
  meal_type_display?: string
  is_compliant: boolean
  compliance_score: number
  photo_url?: string
  photo_file_id?: string
  ai_analysis?: string
  planned_description?: string
  recognized_ingredients?: Array<{ name: string }>
  created_at?: string
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

function useMealReportPhoto(report: MealReport) {
  return useQuery({
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
}

function MealReportImage({ report, onClick }: { report: MealReport; onClick?: () => void }) {
  const { data: photoUrl, isLoading } = useMealReportPhoto(report)

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
        className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        onClick={onClick}
      />
    )
  }

  return (
    <div className="w-full h-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
      <span className="text-gray-400">Фото недоступно</span>
    </div>
  )
}

function ReportDetailModal({
  report,
  meal,
  onClose,
}: {
  report: MealReport
  meal: Meal
  onClose: () => void
}) {
  const { data: photoUrl } = useMealReportPhoto(report)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Фото */}
        {photoUrl && (
          <div className="relative">
            <img
              src={photoUrl}
              alt="Фото еды"
              className="w-full h-64 object-cover"
            />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
            >
              <X size={18} className="text-white" />
            </button>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Статус соответствия */}
          <div className={`flex items-center gap-3 p-3 rounded-xl ${
            report.is_compliant
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-amber-50 dark:bg-amber-900/20'
          }`}>
            {report.is_compliant ? (
              <CheckCircle size={24} className="text-green-600" />
            ) : (
              <AlertCircle size={24} className="text-amber-600" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${
                report.is_compliant
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}>
                {report.is_compliant ? 'Соответствует программе' : 'Есть отклонения'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Оценка: {report.compliance_score}%
              </p>
            </div>
          </div>

          {/* Что по плану */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              По плану ({meal.name})
            </h3>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {meal.description}
            </p>
          </div>

          {/* Распознанные ингредиенты */}
          {report.recognized_ingredients && report.recognized_ingredients.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Распознано на фото
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.recognized_ingredients.map((ing, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-700 dark:text-gray-300"
                  >
                    {ing.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI анализ */}
          {report.ai_analysis && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Анализ
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {report.ai_analysis}
              </p>
            </div>
          )}

          {/* Кнопка закрытия */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function MealCard({
  meal,
  reports,
  onReportClick,
}: {
  meal: Meal
  reports: MealReport[]
  onReportClick: (report: MealReport) => void
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

        {/* Показываем загруженные фото (если есть) */}
        {reports.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Фото отчёты (нажмите для деталей)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {reports.map((report) => (
                <div key={report.id} className="relative">
                  <MealReportImage
                    report={report}
                    onClick={() => onReportClick(report)}
                  />
                  {/* Индикатор соответствия */}
                  <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                    report.is_compliant
                      ? 'bg-green-500'
                      : 'bg-amber-500'
                  }`}>
                    {report.is_compliant ? (
                      <CheckCircle size={12} className="text-white" />
                    ) : (
                      <AlertCircle size={12} className="text-white" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function NutritionProgram() {
  const navigate = useNavigate()
  const [showNotes, setShowNotes] = useState(false)
  const [selectedReport, setSelectedReport] = useState<{ report: MealReport; meal: Meal } | null>(null)

  const { data: todayData, isLoading, isError, refetch } = useQuery({
    queryKey: ['nutritionProgramToday'],
    queryFn: async () => {
      const { data } = await getNutritionProgramToday()
      return data
    },
  })

  const { data: reportsData } = useQuery({
    queryKey: ['nutritionProgramMealReports'],
    queryFn: async () => {
      const { data } = await getNutritionProgramMealReports()
      return data
    },
    enabled: !!todayData?.has_program,
  })

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
              onReportClick={(report) => setSelectedReport({ report, meal })}
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

      {/* Модальное окно деталей отчёта */}
      <AnimatePresence>
        {selectedReport && (
          <ReportDetailModal
            report={selectedReport.report}
            meal={selectedReport.meal}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default NutritionProgram
