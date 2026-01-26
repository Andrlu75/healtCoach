import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import type { Exercise, MuscleGroup, ExerciseCategory, Difficulty } from '@/types/exercise';
import { muscleGroupLabels, categoryLabels, difficultyLabels } from '@/types/exercise';

interface ExerciseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise | null;
  onSave: (data: Omit<Exercise, 'id'> & { id?: string }, imageFile?: File) => Promise<void>;
}

export const ExerciseForm = ({ open, onOpenChange, exercise, onSave }: ExerciseFormProps) => {
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [category, setCategory] = useState<ExerciseCategory>('strength');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [equipment, setEquipment] = useState('');

  // Reset form when exercise changes
  useEffect(() => {
    if (exercise) {
      setName(exercise.name);
      setDescription(exercise.description);
      setMuscleGroup(exercise.muscleGroup);
      setCategory(exercise.category);
      setDifficulty(exercise.difficulty);
      setEquipment(exercise.equipment || '');
      setImagePreview(exercise.imageUrl || null);
    } else {
      setName('');
      setDescription('');
      setMuscleGroup('chest');
      setCategory('strength');
      setDifficulty('intermediate');
      setEquipment('');
      setImagePreview(null);
    }
    setImageFile(null);
  }, [exercise, open]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSave(
        {
          id: exercise?.id,
          name,
          description,
          muscleGroup,
          category,
          difficulty,
          equipment: equipment || undefined,
          imageUrl: imagePreview || undefined,
        },
        imageFile || undefined
      );
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const muscleGroups = Object.entries(muscleGroupLabels) as [MuscleGroup, string][];
  const categories = Object.entries(categoryLabels) as [ExerciseCategory, string][];
  const difficulties = Object.entries(difficultyLabels) as [Difficulty, string][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exercise ? 'Редактировать упражнение' : 'Новое упражнение'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Image Upload */}
          <div>
            <Label>Изображение</Label>
            <div className="mt-2">
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden h-40 bg-muted">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Загрузить изображение</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Жим штанги лёжа"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Описание *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание техники выполнения..."
              rows={3}
              required
            />
          </div>

          {/* Muscle Group */}
          <div>
            <Label>Группа мышц</Label>
            <Select value={muscleGroup} onValueChange={(v) => setMuscleGroup(v as MuscleGroup)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {muscleGroups.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div>
            <Label>Категория</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExerciseCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty */}
          <div>
            <Label>Сложность</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Equipment */}
          <div>
            <Label htmlFor="equipment">Оборудование</Label>
            <Input
              id="equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Штанга, скамья"
            />
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {exercise ? 'Сохранить' : 'Добавить'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
