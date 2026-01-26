/**
 * Supabase-compatible adapter for Django API
 *
 * Этот модуль предоставляет API, совместимый с Supabase, но использует Django REST API.
 * Позволяет использовать код из fitdb-manager без изменений.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Типы для query builder
interface QueryResult<T> {
  data: T | null;
  error: Error | null;
}

// Маппинг таблиц на Django API endpoints
const tableEndpoints: Record<string, string> = {
  clients: '/clients/fitdb/',
  workouts: '/workouts/fitdb/workouts/',
  workout_exercises: '/workouts/fitdb/workout-exercises/',
  workout_assignments: '/workouts/assignments/',
  workout_sessions: '/workouts/sessions/',
  exercises: '/exercises/fitdb/exercises/',
};

// Query Builder класс
class QueryBuilder<T = any> {
  private tableName: string;
  private endpoint: string;
  private filters: Record<string, any> = {};
  private selectFields: string = '*';
  private orderField: string | null = null;
  private orderAsc: boolean = true;
  private limitCount: number | null = null;
  private isSingle: boolean = false;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private insertData: any = null;
  private updateData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.endpoint = tableEndpoints[tableName] || `/${tableName}/`;
  }

  select(fields: string = '*'): this {
    this.selectFields = fields;
    // Only set operation to select if not already in insert/update mode
    if (this.operation !== 'insert' && this.operation !== 'update') {
      this.operation = 'select';
    }
    return this;
  }

  insert(data: any): this {
    this.insertData = data;
    this.operation = 'insert';
    return this;
  }

  update(data: any): this {
    this.updateData = data;
    this.operation = 'update';
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(field: string, value: any): this {
    this.filters[field] = value;
    return this;
  }

  neq(field: string, value: any): this {
    this.filters[`${field}__ne`] = value;
    return this;
  }

  in(field: string, values: any[]): this {
    this.filters[`${field}__in`] = values.join(',');
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderField = field;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): this {
    this.isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.isSingle = true;
    return this;
  }

  // Выполнение запроса
  async then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      if (onfulfilled) {
        return onfulfilled(result);
      }
      return result as any;
    } catch (error) {
      if (onrejected) {
        return onrejected(error);
      }
      throw error;
    }
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      switch (this.operation) {
        case 'select':
          return await this.executeSelect();
        case 'insert':
          return await this.executeInsert();
        case 'update':
          return await this.executeUpdate();
        case 'delete':
          return await this.executeDelete();
        default:
          throw new Error(`Unknown operation: ${this.operation}`);
      }
    } catch (error: any) {
      console.error(`Supabase adapter error:`, error);
      return { data: null, error: error };
    }
  }

  private async executeSelect(): Promise<QueryResult<T>> {
    // Если есть фильтр по id, делаем запрос на конкретный объект
    if (this.filters.id && Object.keys(this.filters).length === 1) {
      const { data } = await api.get(`${this.endpoint}${this.filters.id}/`);
      const mapped = this.mapFromApi(data);
      return { data: this.isSingle ? mapped : [mapped] as any, error: null };
    }

    // Параметры запроса
    const params: Record<string, any> = { ...this.filters };
    if (this.orderField) {
      params.ordering = this.orderAsc ? this.orderField : `-${this.orderField}`;
    }
    if (this.limitCount) {
      params.limit = this.limitCount;
    }

    const { data: response } = await api.get(this.endpoint, { params });
    let results = Array.isArray(response) ? response : response.results || [];

    // Маппинг данных
    results = results.map((item: any) => this.mapFromApi(item));

    // Если запрошены связанные данные (count), добавляем их
    if (this.selectFields.includes('(count)')) {
      results = await this.addRelatedCounts(results);
    }

    if (this.isSingle) {
      return { data: results[0] || null, error: null };
    }
    return { data: results as any, error: null };
  }

  private async executeInsert(): Promise<QueryResult<T>> {
    const mappedData = this.mapToApi(this.insertData);
    const { data } = await api.post(this.endpoint, mappedData);
    return { data: this.mapFromApi(data), error: null };
  }

  private async executeUpdate(): Promise<QueryResult<T>> {
    if (!this.filters.id) {
      throw new Error('Update requires id filter');
    }
    const mappedData = this.mapToApi(this.updateData);
    const { data } = await api.patch(`${this.endpoint}${this.filters.id}/`, mappedData);
    return { data: this.mapFromApi(data), error: null };
  }

  private async executeDelete(): Promise<QueryResult<T>> {
    // If deleting by id, use standard endpoint
    if (this.filters.id) {
      await api.delete(`${this.endpoint}${this.filters.id}/`);
      return { data: null, error: null };
    }

    // If deleting workout_exercises by workout_id, use bulk_delete endpoint
    if (this.tableName === 'workout_exercises' && this.filters.workout_id) {
      await api.delete(`${this.endpoint}bulk_delete/`, { params: this.filters });
      return { data: null, error: null };
    }

    // If deleting by other filters, pass as query params
    if (Object.keys(this.filters).length > 0) {
      await api.delete(this.endpoint, { params: this.filters });
      return { data: null, error: null };
    }

    throw new Error('Delete requires at least one filter');
  }

  // Маппинг данных из API (snake_case -> camelCase для Supabase-совместимости)
  private mapFromApi(data: any): any {
    if (!data) return data;

    // Для клиентов (FitDB API - уже в правильном формате)
    if (this.tableName === 'clients') {
      return {
        id: String(data.id),
        name: data.name || `Клиент ${data.id}`,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
        created_at: data.created_at,
      };
    }

    // Для тренировок
    if (this.tableName === 'workouts') {
      return {
        id: String(data.id),
        name: data.name,
        description: data.description || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        is_template: data.is_template || false,
        is_favorite: data.is_favorite || false,
      };
    }

    // Для назначений тренировок
    if (this.tableName === 'workout_assignments') {
      return {
        id: String(data.id),
        workout_id: String(data.workout_id || data.workout),
        client_id: String(data.client_id || data.client),
        assigned_at: data.assigned_at || data.created_at,
        due_date: data.due_date || null,
        status: data.status || 'pending',
        notes: data.notes || null,
        workouts: data.workout_detail ? {
          name: data.workout_detail.name,
        } : null,
      };
    }

    // Для сессий тренировок
    if (this.tableName === 'workout_sessions') {
      return {
        id: String(data.id),
        workout_id: String(data.workout_id || data.workout),
        started_at: data.started_at,
        completed_at: data.completed_at || data.finished_at || null,
        duration_seconds: data.duration_seconds || null,
        workouts: data.workout_detail ? {
          name: data.workout_detail.name,
        } : null,
      };
    }

    // Для упражнений в тренировке
    if (this.tableName === 'workout_exercises') {
      return {
        id: String(data.id),
        workout_id: String(data.workout_id || data.workout),
        exercise_id: String(data.exercise_id || data.exercise),
        sets: data.sets || 3,
        reps: data.reps || 10,
        rest_seconds: data.rest_seconds || 60,
        weight_kg: data.weight_kg || null,
        notes: data.notes || null,
        order_index: data.order_index || data.order || 0,
      };
    }

    // Для упражнений (FitDB API - уже в правильном формате)
    if (this.tableName === 'exercises') {
      return {
        id: String(data.id),
        name: data.name,
        description: data.description || '',
        muscleGroup: data.muscleGroup || 'chest',
        category: data.category || 'strength',
        difficulty: data.difficulty || 'intermediate',
        equipment: data.equipment || null,
        imageUrl: data.imageUrl || null,
      };
    }

    return data;
  }

  // Маппинг данных в API (camelCase -> snake_case)
  private mapToApi(data: any): any {
    if (!data) return data;

    // Для клиентов
    if (this.tableName === 'clients') {
      return {
        first_name: data.name?.split(' ')[0] || data.first_name,
        last_name: data.name?.split(' ').slice(1).join(' ') || data.last_name,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
      };
    }

    // Для тренировок
    if (this.tableName === 'workouts') {
      return {
        name: data.name,
        description: data.description,
        is_template: data.is_template,
        is_favorite: data.is_favorite,
      };
    }

    // Для упражнений (FitDB format)
    if (this.tableName === 'exercises') {
      return {
        name: data.name,
        description: data.description,
        muscleGroup: data.muscleGroup,
        category: data.category,
        difficulty: data.difficulty,
        equipment: data.equipment || null,
        imageUrl: data.imageUrl || null,
      };
    }

    // Для упражнений в тренировке
    if (this.tableName === 'workout_exercises') {
      return {
        workout_id: data.workout_id,
        exercise_id: data.exercise_id,
        sets: data.sets,
        reps: data.reps,
        rest_seconds: data.rest_seconds,
        weight_kg: data.weight_kg,
        notes: data.notes,
        order_index: data.order_index,
      };
    }

    // Для назначений
    if (this.tableName === 'workout_assignments') {
      return {
        workout_id: data.workout_id,
        client_id: data.client_id,
        due_date: data.due_date,
        status: data.status,
        notes: data.notes,
      };
    }

    return data;
  }

  // Добавление связанных подсчетов (для workout_exercises(count))
  private async addRelatedCounts(items: any[]): Promise<any[]> {
    if (this.tableName === 'workouts' && this.selectFields.includes('workout_exercises(count)')) {
      // Для каждой тренировки получаем количество упражнений
      return Promise.all(items.map(async (item) => {
        try {
          const { data } = await api.get(`/workouts/workouts/${item.id}/exercises/`);
          const exercises = Array.isArray(data) ? data : data.results || [];
          return {
            ...item,
            workout_exercises: [{ count: exercises.length }],
          };
        } catch {
          return {
            ...item,
            workout_exercises: [{ count: 0 }],
          };
        }
      }));
    }

    if (this.tableName === 'clients' && this.selectFields.includes('workout_assignments(count)')) {
      // Для каждого клиента получаем количество назначений
      return Promise.all(items.map(async (item) => {
        try {
          const { data } = await api.get('/workouts/assignments/', {
            params: { client_id: item.id },
          });
          const assignments = Array.isArray(data) ? data : data.results || [];
          return {
            ...item,
            workout_assignments: [{ count: assignments.length }],
          };
        } catch {
          return {
            ...item,
            workout_assignments: [{ count: 0 }],
          };
        }
      }));
    }

    return items;
  }
}

// Storage заглушка
class StorageBucket {
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  async upload(path: string, file: File) {
    // Загрузка через Django API
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    try {
      const { data } = await api.post('/media/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { data: { path: data.path }, error: null };
    } catch (error: any) {
      console.warn('Storage upload not implemented, using placeholder');
      return { data: { path: `/media/${this.bucketName}/${path}` }, error: null };
    }
  }

  getPublicUrl(path: string) {
    return {
      data: {
        publicUrl: `/media/${this.bucketName}/${path}`,
      },
    };
  }
}

class StorageClient {
  from(bucketName: string) {
    return new StorageBucket(bucketName);
  }
}

// Supabase-совместимый клиент
export const supabase = {
  from: <T = any>(tableName: string): QueryBuilder<T> => {
    return new QueryBuilder<T>(tableName);
  },
  storage: new StorageClient(),
};

export default supabase;
