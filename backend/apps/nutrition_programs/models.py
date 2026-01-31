from django.db import models


class NutritionProgram(models.Model):
    """Программа питания для клиента."""

    STATUS_CHOICES = [
        ('draft', 'Черновик'),
        ('active', 'Активна'),
        ('completed', 'Завершена'),
        ('cancelled', 'Отменена'),
    ]

    client = models.ForeignKey(
        'accounts.Client',
        on_delete=models.CASCADE,
        related_name='nutrition_programs',
        verbose_name='Клиент',
    )
    coach = models.ForeignKey(
        'accounts.Coach',
        on_delete=models.CASCADE,
        related_name='nutrition_programs',
        verbose_name='Коуч',
    )
    name = models.CharField(max_length=200, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')
    start_date = models.DateField(verbose_name='Дата начала')
    end_date = models.DateField(verbose_name='Дата окончания')
    duration_days = models.PositiveIntegerField(verbose_name='Продолжительность (дней)')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        verbose_name='Статус',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'nutrition_programs'
        ordering = ['-created_at']
        verbose_name = 'Программа питания'
        verbose_name_plural = 'Программы питания'
        indexes = [
            models.Index(fields=['client', 'status']),
            models.Index(fields=['client', 'start_date', 'end_date']),
            models.Index(fields=['coach', 'status']),
        ]

    def __str__(self):
        return f'{self.name} ({self.client})'

    def save(self, *args, **kwargs):
        # Автоматически вычисляем end_date из start_date и duration_days
        if self.start_date and self.duration_days:
            from datetime import timedelta
            self.end_date = self.start_date + timedelta(days=self.duration_days - 1)
        super().save(*args, **kwargs)


class NutritionProgramDay(models.Model):
    """День программы питания с разрешёнными/запрещёнными ингредиентами."""

    program = models.ForeignKey(
        NutritionProgram,
        on_delete=models.CASCADE,
        related_name='days',
        verbose_name='Программа',
    )
    day_number = models.PositiveIntegerField(verbose_name='Номер дня')
    date = models.DateField(verbose_name='Дата')
    allowed_ingredients = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Разрешённые ингредиенты',
        help_text='Список разрешённых ингредиентов [{"name": "яблоко"}, ...]',
    )
    forbidden_ingredients = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Запрещённые ингредиенты',
        help_text='Список запрещённых ингредиентов [{"name": "сахар"}, ...]',
    )
    notes = models.TextField(blank=True, verbose_name='Заметки коуча')

    class Meta:
        db_table = 'nutrition_program_days'
        ordering = ['program', 'day_number']
        unique_together = ['program', 'day_number']
        verbose_name = 'День программы питания'
        verbose_name_plural = 'Дни программы питания'
        indexes = [
            models.Index(fields=['program', 'date']),
        ]

    def __str__(self):
        return f'{self.program.name} - День {self.day_number}'

    @property
    def allowed_ingredients_list(self) -> list[str]:
        """Возвращает список названий разрешённых ингредиентов."""
        return [ing.get('name', '') for ing in self.allowed_ingredients if ing.get('name')]

    @property
    def forbidden_ingredients_list(self) -> list[str]:
        """Возвращает список названий запрещённых ингредиентов."""
        return [ing.get('name', '') for ing in self.forbidden_ingredients if ing.get('name')]


class MealComplianceCheck(models.Model):
    """Результат проверки приёма пищи на соответствие программе питания."""

    meal = models.ForeignKey(
        'meals.Meal',
        on_delete=models.CASCADE,
        related_name='compliance_checks',
        verbose_name='Приём пищи',
    )
    program_day = models.ForeignKey(
        NutritionProgramDay,
        on_delete=models.CASCADE,
        related_name='compliance_checks',
        verbose_name='День программы',
    )
    is_compliant = models.BooleanField(verbose_name='Соответствует программе')
    found_forbidden = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Найденные запрещённые ингредиенты',
        help_text='Список найденных запрещённых ингредиентов',
    )
    found_allowed = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Найденные разрешённые ингредиенты',
        help_text='Список найденных разрешённых ингредиентов',
    )
    ai_comment = models.TextField(
        blank=True,
        verbose_name='Комментарий AI',
        help_text='Комментарий AI с рекомендациями',
    )
    coach_notified = models.BooleanField(
        default=False,
        verbose_name='Коуч уведомлён',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meal_compliance_checks'
        ordering = ['-created_at']
        verbose_name = 'Проверка соответствия'
        verbose_name_plural = 'Проверки соответствия'
        indexes = [
            models.Index(fields=['program_day', 'is_compliant']),
        ]

    def __str__(self):
        status = 'Соответствует' if self.is_compliant else 'Нарушение'
        return f'{self.meal} - {status}'
