import axios from 'axios';
import type {
  FitdbExercise,
  FitdbWorkout,
  FitdbWorkoutExercise,
  FitdbClient,
  FitdbAssignment,
  FitdbWorkoutSession,
  FitdbExerciseLog,
  MuscleGroup,
  ExerciseCategory,
  Difficulty,
} from '../../types/fitdb';

const api = axios.create({
  baseURL: '/api',
});

// Helper to convert snake_case to camelCase for exercises
const mapExercise = (e: any): FitdbExercise => {
  // Handle muscleGroups - can come as array or single value
  let muscleGroups: MuscleGroup[] = ['chest'];
  if (Array.isArray(e.muscle_groups)) {
    muscleGroups = e.muscle_groups as MuscleGroup[];
  } else if (e.muscle_group) {
    muscleGroups = [e.muscle_group as MuscleGroup];
  } else if (e.primary_muscle_group) {
    muscleGroups = [e.primary_muscle_group as MuscleGroup];
  }

  return {
    id: String(e.id),
    name: e.name,
    description: e.description || e.instructions || '',
    muscleGroups,
    category: (e.category || e.type_name || 'strength') as ExerciseCategory,
    difficulty: (e.difficulty || 'intermediate') as Difficulty,
    equipment: e.equipment || undefined,
    imageUrl: e.image_url || e.image || undefined,
  };
};

// Exercises API
export const fitdbExercisesApi = {
  list: async () => {
    // Request all exercises (page_size=1000 to overcome default pagination of 20)
    const { data } = await api.get('/exercises/exercises/', {
      params: { page_size: 1000 }
    });
    const exercises = Array.isArray(data) ? data : data.results || [];
    return exercises.map(mapExercise);
  },

  get: async (id: string) => {
    const { data } = await api.get(`/exercises/exercises/${id}/`);
    return mapExercise(data);
  },

  create: async (exercise: Omit<FitdbExercise, 'id'>) => {
    const { data } = await api.post('/exercises/exercises/', {
      name: exercise.name,
      description: exercise.description,
      muscle_groups: exercise.muscleGroups,
      category: exercise.category,
      difficulty: exercise.difficulty,
      equipment: exercise.equipment || null,
      image_url: exercise.imageUrl || null,
    });
    return mapExercise(data);
  },

  update: async (id: string, exercise: Partial<FitdbExercise>) => {
    const { data } = await api.patch(`/exercises/exercises/${id}/`, {
      name: exercise.name,
      description: exercise.description,
      muscle_groups: exercise.muscleGroups,
      category: exercise.category,
      difficulty: exercise.difficulty,
      equipment: exercise.equipment || null,
      image_url: exercise.imageUrl || null,
    });
    return mapExercise(data);
  },

  delete: async (id: string) => {
    await api.delete(`/exercises/exercises/${id}/`);
  },

  uploadImage: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await api.post(`/exercises/exercises/${id}/upload_image/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.image_url;
  },
};

// Helper to map workout from API
const mapWorkout = (w: any): FitdbWorkout => ({
  id: String(w.id),
  name: w.name,
  description: w.description || undefined,
  exercises: (w.exercises || w.workout_exercises || []).map(mapWorkoutExercise),
  createdAt: w.created_at || w.createdAt || new Date().toISOString(),
  updatedAt: w.updated_at || w.updatedAt || new Date().toISOString(),
  isTemplate: w.is_template || false,
  isFavorite: w.is_favorite || false,
});

const mapWorkoutExercise = (e: any): FitdbWorkoutExercise => ({
  id: String(e.id),
  exerciseId: String(e.exercise_id || e.exercise?.id),
  sets: e.sets || 3,
  reps: e.reps || 10,
  restSeconds: e.rest_seconds || e.restSeconds || 60,
  weightKg: e.weight_kg || e.weightKg || undefined,
  notes: e.notes || undefined,
  orderIndex: e.order_index || e.orderIndex || 0,
  exercise: e.exercise ? mapExercise(e.exercise) : undefined,
});

// Workouts API
export const fitdbWorkoutsApi = {
  list: async (isTemplate = false) => {
    const { data } = await api.get('/workouts/workouts/', {
      params: { is_template: isTemplate },
    });
    const workouts = Array.isArray(data) ? data : data.results || [];
    return workouts.map(mapWorkout);
  },

  get: async (id: string) => {
    const { data } = await api.get(`/workouts/workouts/${id}/`);
    return mapWorkout(data);
  },

  create: async (workout: { name: string; description?: string; isTemplate?: boolean }) => {
    const { data } = await api.post('/workouts/workouts/', {
      name: workout.name,
      description: workout.description || null,
      is_template: workout.isTemplate || false,
    });
    return mapWorkout(data);
  },

  update: async (id: string, workout: { name?: string; description?: string; isFavorite?: boolean }) => {
    const { data } = await api.patch(`/workouts/workouts/${id}/`, {
      name: workout.name,
      description: workout.description,
      is_favorite: workout.isFavorite,
    });
    return mapWorkout(data);
  },

  delete: async (id: string) => {
    await api.delete(`/workouts/workouts/${id}/`);
  },

  // Workout exercises
  getExercises: async (workoutId: string) => {
    const { data } = await api.get(`/workouts/workouts/${workoutId}/exercises/`);
    const exercises = Array.isArray(data) ? data : data.results || [];
    return exercises.map(mapWorkoutExercise);
  },

  setExercises: async (workoutId: string, exercises: Omit<FitdbWorkoutExercise, 'id' | 'exercise'>[]) => {
    const { data } = await api.post(`/workouts/workouts/${workoutId}/set_exercises/`, {
      exercises: exercises.map((e, index) => ({
        exercise_id: e.exerciseId,
        sets: e.sets,
        reps: e.reps,
        rest_seconds: e.restSeconds,
        weight_kg: e.weightKg || null,
        notes: e.notes || null,
        order_index: index,
      })),
    });
    return data;
  },

  duplicate: async (id: string, name?: string) => {
    const { data } = await api.post(`/workouts/workouts/${id}/duplicate/`, { name });
    return mapWorkout(data);
  },
};

// Templates API (uses workouts with is_template=true)
export const fitdbTemplatesApi = {
  list: async () => {
    return fitdbWorkoutsApi.list(true);
  },

  get: async (id: string) => {
    return fitdbWorkoutsApi.get(id);
  },

  create: async (template: { name: string; description?: string }) => {
    return fitdbWorkoutsApi.create({ ...template, isTemplate: true });
  },

  update: async (id: string, template: { name?: string; description?: string; isFavorite?: boolean }) => {
    return fitdbWorkoutsApi.update(id, template);
  },

  delete: async (id: string) => {
    return fitdbWorkoutsApi.delete(id);
  },
};

// Helper to map client from API
const mapClient = (c: any): FitdbClient => ({
  id: String(c.id),
  name: c.name,
  email: c.email || null,
  phone: c.phone || null,
  notes: c.notes || null,
  createdAt: c.created_at || c.createdAt || new Date().toISOString(),
  assignmentCount: c.assignment_count || c.workout_assignments?.length || 0,
});

// Clients API
export const fitdbClientsApi = {
  list: async () => {
    const { data } = await api.get('/workouts/clients/');
    const clients = Array.isArray(data) ? data : data.results || [];
    return clients.map(mapClient);
  },

  get: async (id: string) => {
    const { data } = await api.get(`/workouts/clients/${id}/`);
    return mapClient(data);
  },

  create: async (client: { name: string; email?: string; phone?: string; notes?: string }) => {
    const { data } = await api.post('/workouts/clients/', {
      name: client.name,
      email: client.email || null,
      phone: client.phone || null,
      notes: client.notes || null,
    });
    return mapClient(data);
  },

  update: async (id: string, client: { name?: string; email?: string; phone?: string; notes?: string }) => {
    const { data } = await api.patch(`/workouts/clients/${id}/`, {
      name: client.name,
      email: client.email,
      phone: client.phone,
      notes: client.notes,
    });
    return mapClient(data);
  },

  delete: async (id: string) => {
    await api.delete(`/workouts/clients/${id}/`);
  },
};

// Helper to map assignment from API
const mapAssignment = (a: any): FitdbAssignment => ({
  id: String(a.id),
  workoutId: String(a.workout_id || a.workout?.id),
  workoutName: a.workout_name || a.workout?.name || 'Тренировка',
  assignedAt: a.assigned_at || a.assignedAt || new Date().toISOString(),
  dueDate: a.due_date || a.dueDate || null,
  status: a.status || 'pending',
  notes: a.notes || null,
});

// Assignments API
export const fitdbAssignmentsApi = {
  list: async (clientId?: string) => {
    const { data } = await api.get('/workouts/assignments/', {
      params: clientId ? { client_id: clientId } : {},
    });
    const assignments = Array.isArray(data) ? data : data.results || [];
    return assignments.map(mapAssignment);
  },

  getByClient: async (clientId: string) => {
    const { data } = await api.get(`/workouts/clients/${clientId}/assignments/`);
    const assignments = Array.isArray(data) ? data : data.results || [];
    return assignments.map(mapAssignment);
  },

  create: async (assignment: {
    clientId: string;
    workoutId: string;
    dueDate?: string;
    notes?: string;
  }) => {
    const { data } = await api.post('/workouts/assignments/', {
      client_id: assignment.clientId,
      workout_id: assignment.workoutId,
      due_date: assignment.dueDate || null,
      notes: assignment.notes || null,
    });
    return mapAssignment(data);
  },

  updateStatus: async (id: string, status: 'pending' | 'active' | 'completed') => {
    const { data } = await api.patch(`/workouts/assignments/${id}/`, { status });
    return mapAssignment(data);
  },

  delete: async (id: string) => {
    await api.delete(`/workouts/assignments/${id}/`);
  },
};

// Helper to map session from API
const mapSession = (s: any): FitdbWorkoutSession => ({
  id: String(s.id),
  workoutId: String(s.workout_id || s.workout?.id),
  workoutName: s.workout_name || s.workout?.name || 'Тренировка',
  startedAt: s.started_at || s.startedAt || new Date().toISOString(),
  completedAt: s.completed_at || s.completedAt || null,
  durationSeconds: s.duration_seconds || s.durationSeconds || null,
  exerciseLogs: (s.exercise_logs || s.logs || []).map(mapExerciseLog),
});

const mapExerciseLog = (log: any): FitdbExerciseLog => ({
  id: String(log.id),
  exerciseId: String(log.exercise_id || log.exercise?.id),
  exerciseName: log.exercise_name || log.exercise?.name || 'Упражнение',
  setNumber: log.set_number || log.setNumber || 1,
  repsCompleted: log.reps_completed || log.repsCompleted || 0,
  weightKg: log.weight_kg || log.weightKg || null,
  completedAt: log.completed_at || log.completedAt || new Date().toISOString(),
});

// Sessions API
export const fitdbSessionsApi = {
  list: async () => {
    const { data } = await api.get('/workouts/sessions/');
    const sessions = Array.isArray(data) ? data : data.results || [];
    return sessions.map(mapSession);
  },

  get: async (id: string) => {
    const { data } = await api.get(`/workouts/sessions/${id}/`);
    return mapSession(data);
  },

  create: async (workoutId: string) => {
    const { data } = await api.post('/workouts/sessions/', { workout_id: workoutId });
    return mapSession(data);
  },

  complete: async (id: string, durationSeconds: number) => {
    const { data } = await api.post(`/workouts/sessions/${id}/complete/`, {
      duration_seconds: durationSeconds,
    });
    return mapSession(data);
  },

  delete: async (id: string) => {
    await api.delete(`/workouts/sessions/${id}/`);
  },

  // Exercise logs
  logExercise: async (sessionId: string, log: {
    exerciseId: string;
    setNumber: number;
    repsCompleted: number;
    weightKg?: number;
  }) => {
    const { data } = await api.post(`/workouts/sessions/${sessionId}/log/`, {
      exercise_id: log.exerciseId,
      set_number: log.setNumber,
      reps_completed: log.repsCompleted,
      weight_kg: log.weightKg || null,
    });
    return mapExerciseLog(data);
  },
};

// Dashboard API
export const fitdbDashboardApi = {
  getStats: async () => {
    const { data } = await api.get('/workouts/dashboard/stats/');
    return {
      totalClients: data.total_clients || 0,
      totalAssignments: data.total_assignments || 0,
      completedAssignments: data.completed_assignments || 0,
      activeAssignments: data.active_assignments || 0,
      pendingAssignments: data.pending_assignments || 0,
      overallCompletionRate: data.completion_rate || 0,
      thisMonthAssignments: data.this_month_assignments || 0,
      thisMonthCompleted: data.this_month_completed || 0,
    };
  },

  getClientStats: async () => {
    const { data } = await api.get('/workouts/dashboard/client-stats/');
    const stats = Array.isArray(data) ? data : data.results || [];
    return stats.map((c: any) => ({
      id: String(c.id),
      name: c.name,
      email: c.email || null,
      total: c.total || 0,
      completed: c.completed || 0,
      completionRate: c.completion_rate || 0,
    }));
  },
};
