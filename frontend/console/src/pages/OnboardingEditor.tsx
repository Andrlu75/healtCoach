import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Save } from 'lucide-react'
import { onboardingApi } from '../api/data'
import type { OnboardingQuestion } from '../types'

const questionTypes: Record<string, string> = {
  text: 'Текст',
  number: 'Число',
  choice: 'Выбор',
  multi_choice: 'Мульти-выбор',
  date: 'Дата',
}

export default function OnboardingEditor() {
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    loadQuestions()
  }, [])

  const loadQuestions = () => {
    setLoading(true)
    onboardingApi.getQuestions()
      .then(({ data }) => setQuestions(data))
      .finally(() => setLoading(false))
  }

  const moveQuestion = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= questions.length) return

    const current = questions[index]
    const swap = questions[swapIndex]

    // Swap orders
    await Promise.all([
      onboardingApi.updateQuestion(current.id, { order: swap.order }),
      onboardingApi.updateQuestion(swap.id, { order: current.order }),
    ])

    loadQuestions()
  }

  const deleteQuestion = async (id: number) => {
    await onboardingApi.deleteQuestion(id)
    setQuestions((q) => q.filter((x) => x.id !== id))
  }

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Анкета онбординга</h1>
        <button
          onClick={() => { setShowNew(true); setEditingId(null) }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          Добавить вопрос
        </button>
      </div>

      {showNew && (
        <QuestionForm
          onSave={() => { setShowNew(false); loadQuestions() }}
          onCancel={() => setShowNew(false)}
          nextOrder={questions.length}
        />
      )}

      {questions.length === 0 && !showNew ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Вопросы не добавлены
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => (
            <div key={q.id}>
              {editingId === q.id ? (
                <QuestionForm
                  question={q}
                  onSave={() => { setEditingId(null); loadQuestions() }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveQuestion(idx, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveQuestion(idx, 'down')}
                      disabled={idx === questions.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">{idx + 1}.</span>
                      <span className="text-sm font-medium text-gray-900">{q.text}</span>
                      {q.is_required && (
                        <span className="text-xs text-red-500">*</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                        {questionTypes[q.question_type]}
                      </span>
                      {q.field_key && (
                        <span className="text-xs text-gray-400">→ {q.field_key}</span>
                      )}
                      {q.options.length > 0 && (
                        <span className="text-xs text-gray-400">
                          ({q.options.join(', ')})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingId(q.id)}
                      className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionForm({
  question,
  onSave,
  onCancel,
  nextOrder,
}: {
  question?: OnboardingQuestion
  onSave: () => void
  onCancel: () => void
  nextOrder?: number
}) {
  const [text, setText] = useState(question?.text || '')
  const [questionType, setQuestionType] = useState<string>(question?.question_type || 'text')
  const [options, setOptions] = useState(question?.options.join('\n') || '')
  const [isRequired, setIsRequired] = useState(question?.is_required ?? true)
  const [fieldKey, setFieldKey] = useState(question?.field_key || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      const data: Partial<OnboardingQuestion> = {
        text: text.trim(),
        question_type: questionType as OnboardingQuestion['question_type'],
        options: options.trim() ? options.trim().split('\n').map((s) => s.trim()).filter(Boolean) : [],
        is_required: isRequired,
        order: question?.order ?? nextOrder ?? 0,
        field_key: fieldKey,
      }
      if (question) {
        await onboardingApi.updateQuestion(question.id, data)
      } else {
        await onboardingApi.createQuestion(data)
      }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-blue-200 p-4 mb-2">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500">Текст вопроса</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
            placeholder="Какой у вас рост?"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Тип ответа</label>
          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
          >
            {Object.entries(questionTypes).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {(questionType === 'choice' || questionType === 'multi_choice') && (
        <div className="mb-3">
          <label className="text-xs text-gray-500">Варианты (по одному на строку)</label>
          <textarea
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
            rows={3}
            placeholder={"Вариант 1\nВариант 2\nВариант 3"}
          />
        </div>
      )}

      <div className="flex items-center gap-4 mb-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
          />
          Обязательный
        </label>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Ключ поля</label>
          <input
            type="text"
            value={fieldKey}
            onChange={(e) => setFieldKey(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
            placeholder="height"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !text.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
