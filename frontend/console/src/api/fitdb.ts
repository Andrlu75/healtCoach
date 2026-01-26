/**
 * FitDB API client - direct calls to Django API
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Types
export interface Exercise {
  id: string;
  name: string;
  description: string;
  muscleGroup: string;
  category: string;
  difficulty: string;
  equipment?: string;
  imageUrl?: string;
}

export interface Workout {
  id: string;
  name: string;
  description?: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  rest_seconds: number;
  weight_kg?: number;
  notes?: string;
  order_index: number;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  created_at: string;
}

// Exercises API
export const exercisesApi = {
  async list(params?: { ordering?: string; search?: string }) {
    const { data } = await api.get('/exercises/fitdb/exercises/', { params });
    return data.results || data;
  },

  async get(id: string) {
    const { data } = await api.get(`/exercises/fitdb/exercises/${id}/`);
    return data;
  },

  async create(exercise: Partial<Exercise>) {
    const { data } = await api.post('/exercises/fitdb/exercises/', exercise);
    return data;
  },

  async update(id: string, exercise: Partial<Exercise>) {
    const { data } = await api.patch(`/exercises/fitdb/exercises/${id}/`, exercise);
    return data;
  },

  async delete(id: string) {
    await api.delete(`/exercises/fitdb/exercises/${id}/`);
  },
};

// Workouts API
export const workoutsApi = {
  async list(params?: { ordering?: string; search?: string }) {
    const { data } = await api.get('/workouts/fitdb/workouts/', { params });
    return data.results || data;
  },

  async get(id: string) {
    const { data } = await api.get(`/workouts/fitdb/workouts/${id}/`);
    return data;
  },

  async create(workout: { name: string; description?: string }) {
    const { data } = await api.post('/workouts/fitdb/workouts/', workout);
    return data;
  },

  async update(id: string, workout: { name?: string; description?: string }) {
    const { data } = await api.patch(`/workouts/fitdb/workouts/${id}/`, workout);
    return data;
  },

  async delete(id: string) {
    await api.delete(`/workouts/fitdb/workouts/${id}/`);
  },
};

// Workout Exercises API
export const workoutExercisesApi = {
  async list(workoutId: string) {
    const { data } = await api.get('/workouts/fitdb/workout-exercises/', {
      params: { workout_id: workoutId },
    });
    return Array.isArray(data) ? data : data.results || [];
  },

  async create(exercise: {
    workout_id: string;
    exercise_id: string;
    sets: number;
    reps: number;
    rest_seconds: number;
    weight_kg?: number;
    notes?: string;
    order_index: number;
  }) {
    const { data } = await api.post('/workouts/fitdb/workout-exercises/', exercise);
    return data;
  },

  async bulkCreate(exercises: Array<{
    workout_id: string;
    exercise_id: string;
    sets: number;
    reps: number;
    rest_seconds: number;
    weight_kg?: number;
    notes?: string;
    order_index: number;
  }>) {
    const { data } = await api.post('/workouts/fitdb/workout-exercises/', exercises);
    return data;
  },

  async delete(id: string) {
    await api.delete(`/workouts/fitdb/workout-exercises/${id}/`);
  },

  async deleteByWorkout(workoutId: string) {
    await api.delete('/workouts/fitdb/workout-exercises/bulk_delete/', {
      params: { workout_id: workoutId },
    });
  },
};

// Clients API
export const clientsApi = {
  async list(params?: { ordering?: string; search?: string }) {
    const { data } = await api.get('/clients/fitdb/', { params });
    return data.results || data;
  },

  async get(id: string) {
    const { data } = await api.get(`/clients/fitdb/${id}/`);
    return data;
  },
};
