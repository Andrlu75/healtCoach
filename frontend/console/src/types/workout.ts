export interface Workout {
  id: string;
  name: string;
  description?: string;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  // Силовые параметры
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg?: number;
  // Кардио параметры
  durationSeconds?: number;  // время в секундах
  distanceMeters?: number;   // дистанция в метрах
  // Общие
  notes?: string;
  orderIndex: number;
}
