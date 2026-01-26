export type MuscleGroup = 
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'glutes'
  | 'abs'
  | 'cardio';

export type ExerciseCategory = 
  | 'strength'
  | 'cardio'
  | 'flexibility'
  | 'plyometric';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  muscleGroup: MuscleGroup;
  category: ExerciseCategory;
  difficulty: Difficulty;
  equipment?: string;
  imageUrl?: string;
}

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  legs: 'Ноги',
  glutes: 'Ягодицы',
  abs: 'Пресс',
  cardio: 'Кардио',
};

export const categoryLabels: Record<ExerciseCategory, string> = {
  strength: 'Силовые',
  cardio: 'Кардио',
  flexibility: 'Растяжка',
  plyometric: 'Плиометрика',
};

export const difficultyLabels: Record<Difficulty, string> = {
  beginner: 'Начинающий',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

export const muscleGroupIcons: Record<MuscleGroup, string> = {
  chest: '💪',
  back: '🔙',
  shoulders: '🎯',
  biceps: '💪',
  triceps: '💪',
  legs: '🦵',
  glutes: '🍑',
  abs: '🔥',
  cardio: '❤️',
};
