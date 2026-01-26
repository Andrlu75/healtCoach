from django.db import models


class ClientWorkout(models.Model):
    """Тренировка клиента (индивидуальная)"""
    STATUS_CHOICES = [
        ('draft', 'Черновик'),
        ('scheduled', 'Запланирована'),
        ('in_progress', 'В процессе'),
        ('completed', 'Завершена'),
        ('skipped', 'Пропущена'),
    ]

    client = models.ForeignKey(
        'accounts.Client',
        on_delete=models.CASCADE,
        related_name='workouts'
    )
    # Опционально - из какого шаблона создана
    template = models.ForeignKey(
        'workouts.WorkoutTemplate',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='client_workouts'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    # Запланированная дата/время
    scheduled_date = models.DateField(null=True, blank=True)
    scheduled_time = models.TimeField(null=True, blank=True)

    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='draft'
    )
    estimated_duration = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Примерная длительность в минутах'
    )
    difficulty = models.CharField(
        max_length=15,
        choices=[
            ('beginner', 'Начинающий'),
            ('intermediate', 'Средний'),
            ('advanced', 'Продвинутый'),
        ],
        default='intermediate'
    )
    notes = models.TextField(blank=True, help_text='Заметки коуча для клиента')

    # Напоминание
    reminder_enabled = models.BooleanField(default=True)
    reminder_minutes_before = models.PositiveIntegerField(
        default=60,
        help_text='За сколько минут напомнить'
    )
    reminder_sent = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'client_workouts'
        ordering = ['-scheduled_date', '-scheduled_time']

    def __str__(self):
        return f"{self.client} - {self.name}"

    @property
    def coach(self):
        return self.client.coach


class WorkoutBlock(models.Model):
    """Блок в тренировке клиента"""
    BLOCK_TYPE_CHOICES = [
        ('warmup', 'Разминка'),
        ('main', 'Основная часть'),
        ('cooldown', 'Заминка'),
        ('custom', 'Пользовательский'),
    ]

    workout = models.ForeignKey(
        ClientWorkout,
        on_delete=models.CASCADE,
        related_name='blocks'
    )
    name = models.CharField(max_length=100)
    block_type = models.CharField(
        max_length=20,
        choices=BLOCK_TYPE_CHOICES,
        default='main'
    )
    order = models.PositiveIntegerField(default=0)
    rounds = models.PositiveIntegerField(default=1)
    rest_between_rounds = models.PositiveIntegerField(
        default=60,
        help_text='Отдых между раундами в секундах'
    )

    class Meta:
        db_table = 'workout_blocks'
        ordering = ['order']

    def __str__(self):
        return f"{self.workout.name} - {self.name}"


class WorkoutSuperset(models.Model):
    """Суперсет - группа упражнений, выполняемых подряд без отдыха"""
    block = models.ForeignKey(
        WorkoutBlock,
        on_delete=models.CASCADE,
        related_name='supersets'
    )
    name = models.CharField(max_length=100, blank=True)
    order = models.PositiveIntegerField(default=0)
    rounds = models.PositiveIntegerField(default=1)
    rest_after = models.PositiveIntegerField(
        default=90,
        help_text='Отдых после суперсета в секундах'
    )

    class Meta:
        db_table = 'workout_supersets'
        ordering = ['order']

    def __str__(self):
        return f"{self.block} - Суперсет {self.order}"


class WorkoutExercise(models.Model):
    """Упражнение в тренировке клиента"""
    block = models.ForeignKey(
        WorkoutBlock,
        on_delete=models.CASCADE,
        related_name='exercises'
    )
    exercise = models.ForeignKey(
        'exercises.Exercise',
        on_delete=models.CASCADE,
        related_name='workout_usages'
    )
    # Если упражнение в суперсете
    superset = models.ForeignKey(
        WorkoutSuperset,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='exercises'
    )
    order = models.PositiveIntegerField(default=0)
    # Параметры упражнения
    parameters = models.JSONField(default=dict)
    rest_after = models.PositiveIntegerField(
        default=60,
        help_text='Отдых после упражнения в секундах'
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'workout_exercises'
        ordering = ['order']

    def __str__(self):
        return f"{self.block.workout.name} - {self.exercise.name}"
