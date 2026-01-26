import { useState, useRef } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import type {
  FitdbExercise,
  MuscleGroup,
  ExerciseCategory,
  Difficulty,
} from '../../types/fitdb';
import {
  muscleGroupLabels,
  categoryLabels,
  difficultyLabels,
} from '../../types/fitdb';

interface ExerciseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: FitdbExercise | null;
  onSave: (data: Omit<FitdbExercise, 'id'> & { id?: string }, imageFile?: File) => Promise<void>;
}

const muscleGroups: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'abs', 'cardio'];
const categories: ExerciseCategory[] = ['strength', 'cardio', 'flexibility', 'plyometric'];
const difficulties: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

export function ExerciseForm({ open, onOpenChange, exercise, onSave }: ExerciseFormProps) {
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: exercise?.name || '',
    description: exercise?.description || '',
    muscleGroup: exercise?.muscleGroup || 'chest' as MuscleGroup,
    category: exercise?.category || 'strength' as ExerciseCategory,
    difficulty: exercise?.difficulty || 'intermediate' as Difficulty,
    equipment: exercise?.equipment || '',
    imageUrl: exercise?.imageUrl || '',
  });

  // Reset form when exercise changes
  useState(() => {
    if (open) {
      setForm({
        name: exercise?.name || '',
        description: exercise?.description || '',
        muscleGroup: exercise?.muscleGroup || 'chest',
        category: exercise?.category || 'strength',
        difficulty: exercise?.difficulty || 'intermediate',
        equipment: exercise?.equipment || '',
        imageUrl: exercise?.imageUrl || '',
      });
      setImageFile(null);
      setImagePreview(exercise?.imageUrl || null);
    }
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(
        {
          ...form,
          id: exercise?.id,
        },
        imageFile || undefined
      );
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {exercise ? 'Редактировать упражнение' : 'Новое упражнение'}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Изображение
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-lg"
                />
              ) : (
                <div className="py-8">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Нажмите для загрузки</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Muscle Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Группа мышц
            </label>
            <div className="flex flex-wrap gap-2">
              {muscleGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setForm({ ...form, muscleGroup: group })}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    form.muscleGroup === group
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {muscleGroupLabels[group]}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Категория
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setForm({ ...form, category })}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    form.category === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {categoryLabels[category]}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Сложность
            </label>
            <div className="flex gap-2">
              {difficulties.map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setForm({ ...form, difficulty: diff })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                    form.difficulty === diff
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {difficultyLabels[diff]}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Оборудование
            </label>
            <input
              type="text"
              value={form.equipment}
              onChange={(e) => setForm({ ...form, equipment: e.target.value })}
              placeholder="Штанга, гантели..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !form.name}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {exercise ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
