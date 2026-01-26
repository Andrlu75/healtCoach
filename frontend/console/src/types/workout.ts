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
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg?: number;
  notes?: string;
  orderIndex: number;
}
