"""
FitDB models for workout tracking - simplified interface
"""
from django.db import models


class FitDBWorkoutAssignment(models.Model):
    """Assignment of a workout template to a client"""
    STATUS_CHOICES = [
        ('pending', 'Ожидает'),
        ('active', 'В процессе'),
        ('completed', 'Выполнено'),
    ]

    workout = models.ForeignKey(
        'workouts.WorkoutTemplate',
        on_delete=models.CASCADE,
        related_name='fitdb_assignments'
    )
    client = models.ForeignKey(
        'accounts.Client',
        on_delete=models.CASCADE,
        related_name='workout_assignments'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='pending'
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'fitdb_workout_assignments'
        ordering = ['-assigned_at']
        indexes = [
            models.Index(fields=['client', '-assigned_at']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['workout']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.workout.name} -> {self.client}"


class FitDBWorkoutSession(models.Model):
    """Session of workout execution in FitDB format"""
    workout = models.ForeignKey(
        'workouts.WorkoutTemplate',
        on_delete=models.CASCADE,
        related_name='fitdb_sessions'
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'fitdb_workout_sessions'
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.workout.name} - {self.started_at}"


class FitDBExerciseLog(models.Model):
    """Log of exercise set execution in FitDB format"""
    session = models.ForeignKey(
        FitDBWorkoutSession,
        on_delete=models.CASCADE,
        related_name='exercise_logs'
    )
    exercise = models.ForeignKey(
        'exercises.Exercise',
        on_delete=models.CASCADE,
        related_name='fitdb_logs'
    )
    set_number = models.PositiveIntegerField()
    reps_completed = models.PositiveIntegerField()
    weight_kg = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True
    )
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fitdb_exercise_logs'
        ordering = ['session', 'exercise', 'set_number']

    def __str__(self):
        return f"{self.exercise.name} - Set {self.set_number}"


class FitDBActivityLog(models.Model):
    """Detailed activity log for coach analysis"""
    EVENT_TYPES = [
        ('workout_started', 'Тренировка начата'),
        ('workout_paused', 'Тренировка приостановлена'),
        ('workout_resumed', 'Тренировка возобновлена'),
        ('workout_completed', 'Тренировка завершена'),
        ('exercise_started', 'Упражнение начато'),
        ('exercise_completed', 'Упражнение завершено'),
        ('exercise_skipped', 'Упражнение пропущено'),
        ('set_completed', 'Подход выполнен'),
        ('set_skipped', 'Подход пропущен'),
        ('rest_started', 'Отдых начат'),
        ('rest_skipped', 'Отдых пропущен'),
    ]

    session = models.ForeignKey(
        FitDBWorkoutSession,
        on_delete=models.CASCADE,
        related_name='activity_logs'
    )
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES)
    timestamp = models.DateTimeField(auto_now_add=True)

    # Optional references
    exercise = models.ForeignKey(
        'exercises.Exercise',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs'
    )
    set_number = models.PositiveIntegerField(null=True, blank=True)

    # Event details (reps, weight, duration, etc.)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'fitdb_activity_logs'
        ordering = ['session', 'timestamp']

    def __str__(self):
        return f"{self.get_event_type_display()} - {self.timestamp}"
