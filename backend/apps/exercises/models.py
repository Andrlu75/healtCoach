from django.db import models


class ExerciseCategory(models.Model):
    """Категории упражнений (Ноги, Спина, Кардио и т.д.)"""
    coach = models.ForeignKey(
        'accounts.Coach',
        on_delete=models.CASCADE,
        related_name='exercise_categories'
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default='#3B82F6')  # HEX цвет для UI
    icon = models.CharField(max_length=50, blank=True)  # иконка для UI
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exercise_categories'
        ordering = ['order', 'name']
        unique_together = ['coach', 'name']

    def __str__(self):
        return self.name


class ExerciseType(models.Model):
    """
    Типы упражнений с настраиваемыми параметрами.
    Например: силовое (подходы, повторения, вес), кардио (время, дистанция), статика (время)
    """
    PARAMETER_TYPES = [
        ('sets', 'Подходы'),
        ('reps', 'Повторения'),
        ('weight', 'Вес (кг)'),
        ('duration', 'Время (сек)'),
        ('distance', 'Дистанция (м)'),
        ('calories', 'Калории'),
        ('pace', 'Темп'),
        ('heart_rate', 'Пульс'),
    ]

    coach = models.ForeignKey(
        'accounts.Coach',
        on_delete=models.CASCADE,
        related_name='exercise_types'
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    # Список параметров, которые используются для этого типа
    # Например: ["sets", "reps", "weight"] для силовых
    parameters = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exercise_types'
        ordering = ['name']
        unique_together = ['coach', 'name']

    def __str__(self):
        return self.name


class Exercise(models.Model):
    """Упражнение в базе коуча"""
    DIFFICULTY_CHOICES = [
        ('beginner', 'Начинающий'),
        ('intermediate', 'Средний'),
        ('advanced', 'Продвинутый'),
    ]

    MEDIA_TYPE_CHOICES = [
        ('image', 'Изображение'),
        ('video', 'Видео'),
    ]

    coach = models.ForeignKey(
        'accounts.Coach',
        on_delete=models.CASCADE,
        related_name='exercises'
    )
    category = models.ForeignKey(
        ExerciseCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exercises'
    )
    exercise_type = models.ForeignKey(
        ExerciseType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exercises'
    )

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    # Пошаговая инструкция выполнения
    instructions = models.JSONField(default=list, blank=True)

    # Медиа
    image = models.ImageField(upload_to='exercises/%Y/%m/', blank=True)
    video_url = models.URLField(blank=True)  # Внешняя ссылка на видео (YouTube и т.д.)
    media_type = models.CharField(
        max_length=10,
        choices=MEDIA_TYPE_CHOICES,
        default='image'
    )

    # Значения по умолчанию для параметров типа
    # Например: {"sets": 3, "reps": 12, "weight": 0}
    default_parameters = models.JSONField(default=dict, blank=True)

    # Дополнительная информация
    muscle_groups = models.JSONField(default=list, blank=True)  # ["квадрицепс", "ягодицы"]
    equipment = models.JSONField(default=list, blank=True)  # ["гантели", "скамья"]
    difficulty = models.CharField(
        max_length=15,
        choices=DIFFICULTY_CHOICES,
        default='intermediate'
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'exercises'
        ordering = ['name']
        indexes = [
            models.Index(fields=['is_active']),
            models.Index(fields=['name']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['is_active', '-created_at']),  # Common query pattern
            models.Index(fields=['is_active', 'name']),
        ]

    def __str__(self):
        return self.name
