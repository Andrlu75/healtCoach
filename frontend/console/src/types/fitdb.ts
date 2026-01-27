// Exercise types
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

export interface FitdbExercise {
  id: string;
  name: string;
  description: string;
  muscleGroups: MuscleGroup[];
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

// Workout types
export interface FitdbWorkout {
  id: string;
  name: string;
  description?: string;
  exercises: FitdbWorkoutExercise[];
  createdAt: string;
  updatedAt: string;
  isTemplate?: boolean;
  isFavorite?: boolean;
}

export interface FitdbWorkoutExercise {
  id: string;
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg?: number;
  notes?: string;
  orderIndex: number;
  exercise?: FitdbExercise;
}

// Client types
export interface FitdbClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  assignmentCount?: number;
}

// Assignment types
export interface FitdbAssignment {
  id: string;
  workoutId: string;
  workoutName: string;
  assignedAt: string;
  dueDate: string | null;
  status: 'pending' | 'active' | 'completed';
  notes: string | null;
}

// Session types
export interface FitdbWorkoutSession {
  id: string;
  workoutId: string;
  workoutName: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  exerciseLogs: FitdbExerciseLog[];
}

export interface FitdbExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  repsCompleted: number;
  weightKg: number | null;
  completedAt: string;
}
