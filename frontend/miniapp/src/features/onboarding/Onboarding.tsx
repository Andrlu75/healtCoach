import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react'
import { getOnboardingQuestions, submitOnboarding, type OnboardingQuestion } from '../../api/endpoints'
import { useAuthStore } from '../auth/store'
import { useHaptic } from '../../shared/hooks'
import { Button, Card, Input } from '../../shared/components/ui'
import { cn } from '../../shared/lib/cn'

// Default questions if coach hasn't configured any
const DEFAULT_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 1,
    text: 'Ваш пол',
    type: 'choice',
    options: ['Мужской', 'Женский'],
    is_required: true,
    field_key: 'gender',
  },
  {
    id: 2,
    text: 'Ваш возраст (полных лет)',
    type: 'number',
    options: [],
    is_required: true,
    field_key: 'age',
  },
  {
    id: 3,
    text: 'Ваш рост (см)',
    type: 'number',
    options: [],
    is_required: true,
    field_key: 'height',
  },
  {
    id: 4,
    text: 'Ваш текущий вес (кг)',
    type: 'number',
    options: [],
    is_required: true,
    field_key: 'weight',
  },
  {
    id: 5,
    text: 'Уровень физической активности',
    type: 'choice',
    options: [
      'Сидячий образ жизни',
      'Лёгкая активность (1-3 дня/нед)',
      'Умеренная (3-5 дней/нед)',
      'Высокая (6-7 дней/нед)',
      'Очень высокая (2 раза/день)',
    ],
    is_required: true,
    field_key: 'activity_level',
  },
]

const ACTIVITY_MAP: Record<string, string> = {
  'Сидячий образ жизни': 'sedentary',
  'Лёгкая активность (1-3 дня/нед)': 'light',
  'Умеренная (3-5 дней/нед)': 'moderate',
  'Высокая (6-7 дней/нед)': 'active',
  'Очень высокая (2 раза/день)': 'very_active',
}

const GENDER_MAP: Record<string, string> = {
  'Мужской': 'male',
  'Женский': 'female',
}

export function Onboarding() {
  const { client, setClient } = useAuthStore()
  const { impact, notification } = useHaptic()
  const [step, setStep] = useState(0) // 0 = welcome, 1+ = questions
  const [answers, setAnswers] = useState<Record<string, string | number>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-questions'],
    queryFn: async () => {
      const response = await getOnboardingQuestions()
      return response.data
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (answers: Record<string, unknown>) => {
      const response = await submitOnboarding(answers)
      return response.data
    },
    onSuccess: (data) => {
      notification('success')
      setClient(data.client)
    },
    onError: () => {
      notification('error')
    },
  })

  const questions = data?.questions?.length ? data.questions : DEFAULT_QUESTIONS
  const totalSteps = questions.length + 1 // welcome + questions
  const currentQuestion = step > 0 ? questions[step - 1] : null
  const isLastQuestion = step === questions.length

  const handleNext = () => {
    impact('light')
    if (step === 0) {
      setStep(1)
      return
    }

    if (isLastQuestion) {
      // Submit all answers
      const processedAnswers = { ...answers }

      // Map activity level to backend format
      if (processedAnswers.activity_level && typeof processedAnswers.activity_level === 'string') {
        processedAnswers.activity_level = ACTIVITY_MAP[processedAnswers.activity_level] || processedAnswers.activity_level
      }

      // Map gender to backend format
      if (processedAnswers.gender && typeof processedAnswers.gender === 'string') {
        processedAnswers.gender = GENDER_MAP[processedAnswers.gender] || processedAnswers.gender
      }

      submitMutation.mutate(processedAnswers)
      return
    }

    setStep(step + 1)
  }

  const handleBack = () => {
    impact('light')
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleAnswer = (value: string | number) => {
    if (!currentQuestion) return
    impact('light')

    const key = currentQuestion.field_key || `q_${currentQuestion.id}`
    setAnswers({ ...answers, [key]: value })
  }

  const currentAnswer = currentQuestion
    ? answers[currentQuestion.field_key || `q_${currentQuestion.id}`]
    : undefined

  const canProceed = step === 0 || (currentQuestion && (!currentQuestion.is_required || currentAnswer !== undefined))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-800">
        <motion.div
          className="h-full bg-blue-600"
          initial={{ width: 0 }}
          animate={{ width: `${(step / totalSteps) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex-1 p-6 flex flex-col">
        <AnimatePresence mode="wait">
          {step === 0 ? (
            <WelcomeStep key="welcome" clientName={client?.first_name || ''} />
          ) : (
            <QuestionStep
              key={`question-${step}`}
              question={currentQuestion!}
              answer={currentAnswer}
              onAnswer={handleAnswer}
            />
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-auto pt-6 flex gap-3">
          {step > 0 && (
            <Button
              variant="secondary"
              size="lg"
              onClick={handleBack}
              className="w-12"
            >
              <ChevronLeft size={20} />
            </Button>
          )}
          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canProceed || submitMutation.isPending}
            isLoading={submitMutation.isPending}
            className="flex-1"
          >
            {isLastQuestion ? (
              <>
                <Check size={20} className="mr-2" />
                Завершить
              </>
            ) : (
              <>
                Далее
                <ChevronRight size={20} className="ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function WelcomeStep({ clientName }: { clientName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col items-center justify-center text-center"
    >
      <div className="text-6xl mb-6">👋</div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        Привет{clientName ? `, ${clientName}` : ''}!
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">
        Давайте познакомимся поближе, чтобы рассчитать ваши персональные нормы питания
      </p>
      <Card variant="elevated" className="p-4 max-w-xs">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Это займёт всего пару минут. Ответьте на несколько простых вопросов о себе.
        </p>
      </Card>
    </motion.div>
  )
}

function QuestionStep({
  question,
  answer,
  onAnswer,
}: {
  question: OnboardingQuestion
  answer: string | number | undefined
  onAnswer: (value: string | number) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="flex-1 flex flex-col"
    >
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {question.text}
      </h2>

      {question.type === 'choice' && (
        <div className="space-y-3">
          {question.options.map((option) => (
            <motion.button
              key={option}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onAnswer(option)}
              className={cn(
                'w-full p-4 rounded-xl text-left transition-colors border-2',
                answer === option
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              )}
            >
              <span className={cn(
                'font-medium',
                answer === option
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              )}>
                {option}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {question.type === 'number' && (
        <Input
          type="number"
          inputMode="numeric"
          value={answer?.toString() || ''}
          onChange={(e) => {
            const val = e.target.value
            if (val) {
              onAnswer(parseFloat(val))
            }
          }}
          placeholder="Введите число"
          className="text-2xl text-center py-6"
          autoFocus
        />
      )}

      {question.type === 'text' && (
        <Input
          type="text"
          value={answer?.toString() || ''}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Введите ответ"
          autoFocus
        />
      )}

      {question.type === 'multi_choice' && (
        <div className="space-y-3">
          {question.options.map((option) => {
            const selected = Array.isArray(answer) ? answer.includes(option) : false
            return (
              <motion.button
                key={option}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const current = Array.isArray(answer) ? answer : []
                  const newVal = selected
                    ? current.filter((v) => v !== option)
                    : [...current, option]
                  onAnswer(newVal as unknown as string)
                }}
                className={cn(
                  'w-full p-4 rounded-xl text-left transition-colors border-2',
                  selected
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                )}
              >
                <span className={cn(
                  'font-medium',
                  selected
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300'
                )}>
                  {option}
                </span>
              </motion.button>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
