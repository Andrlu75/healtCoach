from django.db import models


class WorkoutTemplate(models.Model):
    """Шаблон тренировки для быстрого создания"""
    coach = models.ForeignKey(
        'accounts.Coach',
        on_delete=models.CASCADE,
        related_name='workout_templates'
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
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
    tags = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    # Поля для персонализированных копий
    source_template = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='derived_workouts',
        help_text='Шаблон, из которого была создана эта тренировка'
    )
    is_personalized = models.BooleanField(
        default=False,
        help_text='True если это персонализированная копия для клиента'
    )
    created_for_client = models.ForeignKey(
        'accounts.Client',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='personalized_workouts',
        help_text='Клиент, для которого создана эта тренировка'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'workout_templates'
        ordering = ['name']

    def __str__(self):
        return self.name


class WorkoutTemplateBlock(models.Model):
    """Блок в шаблоне тренировки (разминка, основная часть, заминка)"""
    BLOCK_TYPE_CHOICES = [
        ('warmup', 'Разминка'),
        ('main', 'Основная часть'),
        ('cooldown', 'Заминка'),
        ('custom', 'Пользовательский'),
    ]

    template = models.ForeignKey(
        WorkoutTemplate,
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
    # Для круговых тренировок - количество раундов
    rounds = models.PositiveIntegerField(default=1)
    rest_between_rounds = models.PositiveIntegerField(
        default=60,
        help_text='Отдых между раундами в секундах'
    )

    class Meta:
        db_table = 'workout_template_blocks'
        ordering = ['order']

    def __str__(self):
        return f"{self.template.name} - {self.name}"


class WorkoutTemplateExercise(models.Model):
    """Упражнение в блоке шаблона"""
    block = models.ForeignKey(
        WorkoutTemplateBlock,
        on_delete=models.CASCADE,
        related_name='exercises'
    )
    exercise = models.ForeignKey(
        'exercises.Exercise',
        on_delete=models.CASCADE,
        related_name='template_usages'
    )
    order = models.PositiveIntegerField(default=0)
    # Параметры упражнения (sets, reps, weight и т.д.)
    parameters = models.JSONField(default=dict)
    # Отдых после упражнения в секундах
    rest_after = models.PositiveIntegerField(default=60)
    # Для суперсетов - группировка
    superset_group = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Упражнения с одинаковым номером выполняются как суперсет'
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'workout_template_exercises'
        ordering = ['order']

    def __str__(self):
        return f"{self.block} - {self.exercise.name}"
