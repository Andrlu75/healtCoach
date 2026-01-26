from django.db import models


class WorkoutSession(models.Model):
    """Сессия выполнения тренировки"""
    STATUS_CHOICES = [
        ('in_progress', 'В процессе'),
        ('completed', 'Завершена'),
        ('paused', 'Приостановлена'),
        ('abandoned', 'Прервана'),
    ]

    workout = models.ForeignKey(
        'workouts.ClientWorkout',
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='in_progress'
    )
    # Фактическая длительность в секундах
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    # Общая статистика сессии
    total_exercises = models.PositiveIntegerField(default=0)
    completed_exercises = models.PositiveIntegerField(default=0)
    total_sets = models.PositiveIntegerField(default=0)
    completed_sets = models.PositiveIntegerField(default=0)
    # Калории (если рассчитываются)
    calories_burned = models.PositiveIntegerField(null=True, blank=True)
    # Заметки клиента после тренировки
    client_notes = models.TextField(blank=True)
    # Оценка тренировки клиентом (1-5)
    client_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    # Уровень усталости (1-5)
    fatigue_level = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'workout_sessions'
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.workout} - {self.started_at.date()}"

    @property
    def client(self):
        return self.workout.client

    @property
    def completion_percentage(self):
        if self.total_exercises == 0:
            return 0
        return round(self.completed_exercises / self.total_exercises * 100)


class ExerciseLog(models.Model):
    """Лог выполнения упражнения (фактические данные)"""
    session = models.ForeignKey(
        WorkoutSession,
        on_delete=models.CASCADE,
        related_name='exercise_logs'
    )
    workout_exercise = models.ForeignKey(
        'workouts.WorkoutExercise',
        on_delete=models.CASCADE,
        related_name='logs'
    )
    # Номер подхода
    set_number = models.PositiveIntegerField()
    # Фактические значения параметров
    # Например: {"reps": 12, "weight": 50, "duration": 45}
    actual_parameters = models.JSONField(default=dict)
    # Плановые значения (для сравнения)
    planned_parameters = models.JSONField(default=dict)
    # Выполнен ли подход
    is_completed = models.BooleanField(default=False)
    # Время начала и окончания подхода
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    # Заметки к подходу
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'exercise_logs'
        ordering = ['workout_exercise__order', 'set_number']

    def __str__(self):
        return f"{self.workout_exercise.exercise.name} - Подход {self.set_number}"

    @property
    def is_improved(self):
        """Проверяет, улучшился ли результат относительно плана"""
        for key, planned_value in self.planned_parameters.items():
            actual_value = self.actual_parameters.get(key)
            if actual_value and actual_value > planned_value:
                return True
        return False
