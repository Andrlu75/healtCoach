import re

from django.core.exceptions import ValidationError
from django.db import models


def validate_meals_structure(value):
    """
    Валидатор структуры JSONField meals.

    Каждый элемент должен быть словарём с обязательными полями:
    - type: str (из MEAL_TYPE_CHOICES)
    - name: str
    - description: str

    Опциональные поля:
    - time: str в формате HH:MM
    """
    if not isinstance(value, list):
        raise ValidationError('Поле meals должно быть списком')

    valid_types = {'breakfast', 'snack1', 'lunch', 'snack2', 'dinner'}
    time_pattern = re.compile(r'^([01]?\d|2[0-3]):([0-5]\d)$')

    for i, meal in enumerate(value):
        if not isinstance(meal, dict):
            raise ValidationError(f'Элемент #{i + 1} должен быть объектом')

        # Проверка обязательных полей
        if 'type' not in meal:
            raise ValidationError(f'Элемент #{i + 1}: отсутствует поле "type"')

        if meal['type'] not in valid_types:
            raise ValidationError(
                f'Элемент #{i + 1}: недопустимое значение type="{meal["type"]}". '
                f'Допустимые: {", ".join(valid_types)}'
            )

        if 'name' not in meal or not isinstance(meal['name'], str):
            raise ValidationError(f'Элемент #{i + 1}: отсутствует или некорректное поле "name"')

        if 'description' not in meal or not isinstance(meal['description'], str):
            raise ValidationError(f'Элемент #{i + 1}: отсутствует или некорректное поле "description"')

        # Проверка опционального поля time
        if 'time' in meal and meal['time']:
            if not isinstance(meal['time'], str) or not time_pattern.match(meal['time']):
                raise ValidationError(
                    f'Элемент #{i + 1}: поле "time" должно быть в формате HH:MM'
                )


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
    general_notes = models.TextField(
        blank=True,
        verbose_name='Общие заметки',
        help_text='Заметки на всю программу (про воду, режим сна, кофе и т.д.)',
    )
    start_date = models.DateField(verbose_name='Дата начала')
    end_date = models.DateField(verbose_name='Дата окончания')
    duration_days = models.PositiveIntegerField(verbose_name='Продолжительность (дней)')
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        verbose_name='Статус',
    )
    track_compliance = models.BooleanField(
        default=True,
        verbose_name='Отслеживать выполнение',
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
    """День программы питания с меню и разрешёнными/запрещёнными ингредиентами."""

    MEAL_TYPE_CHOICES = [
        ('breakfast', 'Завтрак'),
        ('snack1', 'Перекус 1'),
        ('lunch', 'Обед'),
        ('snack2', 'Перекус 2'),
        ('dinner', 'Ужин'),
    ]

    program = models.ForeignKey(
        NutritionProgram,
        on_delete=models.CASCADE,
        related_name='days',
        verbose_name='Программа',
    )
    day_number = models.PositiveIntegerField(verbose_name='Номер дня')
    date = models.DateField(verbose_name='Дата')
    meals = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Приёмы пищи',
        help_text='Список приёмов пищи [{"type": "breakfast", "time": "8:00", "name": "Завтрак", "description": "..."}]',
        validators=[validate_meals_structure],
    )
    activity = models.TextField(
        blank=True,
        verbose_name='Активность',
        help_text='Рекомендации по физической активности на день',
    )
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
    shopping_list = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Список покупок',
        help_text='Список продуктов для покупки [{"name": "Молоко", "category": "dairy"}, ...]',
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
        return [
            ing.get('name', '')
            for ing in self.allowed_ingredients
            if isinstance(ing, dict) and ing.get('name')
        ]

    @property
    def forbidden_ingredients_list(self) -> list[str]:
        """Возвращает список названий запрещённых ингредиентов."""
        return [
            ing.get('name', '')
            for ing in self.forbidden_ingredients
            if isinstance(ing, dict) and ing.get('name')
        ]

    def get_meal_by_type(self, meal_type: str) -> dict | None:
        """Возвращает приём пищи по типу (breakfast, lunch, dinner и т.д.)."""
        for meal in self.meals:
            if meal.get('type') == meal_type:
                return meal
        return None

    def get_meals_list(self) -> list[dict]:
        """Возвращает отсортированный список приёмов пищи."""
        type_order = {choice[0]: idx for idx, choice in enumerate(self.MEAL_TYPE_CHOICES)}
        return sorted(self.meals, key=lambda m: type_order.get(m.get('type', ''), 99))


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


class MealReport(models.Model):
    """Фото-отчёт о приёме пищи с анализом соответствия программе."""

    MEAL_TYPE_CHOICES = NutritionProgramDay.MEAL_TYPE_CHOICES

    program_day = models.ForeignKey(
        NutritionProgramDay,
        on_delete=models.CASCADE,
        related_name='meal_reports',
        verbose_name='День программы',
    )
    meal_type = models.CharField(
        max_length=20,
        choices=MEAL_TYPE_CHOICES,
        verbose_name='Тип приёма пищи',
    )
    meal_time = models.CharField(
        max_length=10,
        blank=True,
        verbose_name='Время приёма пищи',
        help_text='Время из программы (8:00, 14:00...)',
    )
    photo_file_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Telegram file_id фото',
    )
    photo_url = models.TextField(
        blank=True,
        verbose_name='URL или data URL фото',
        help_text='URL фото (S3) или data URL (base64)',
    )
    planned_description = models.TextField(
        blank=True,
        verbose_name='Запланированное блюдо',
        help_text='Описание блюда из программы питания',
    )
    recognized_ingredients = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Распознанные ингредиенты',
        help_text='Ингредиенты, распознанные AI на фото',
    )
    is_compliant = models.BooleanField(
        default=True,
        verbose_name='Соответствует программе',
    )
    compliance_score = models.PositiveIntegerField(
        default=100,
        verbose_name='Оценка соответствия (%)',
        help_text='Процент соответствия запланированному блюду (0-100)',
    )
    ai_analysis = models.TextField(
        blank=True,
        verbose_name='Анализ AI',
        help_text='Подробный анализ: что совпало, что отличается',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meal_reports'
        ordering = ['-created_at']
        verbose_name = 'Фото-отчёт приёма пищи'
        verbose_name_plural = 'Фото-отчёты приёмов пищи'
        indexes = [
            models.Index(fields=['program_day', 'meal_type']),
            models.Index(fields=['program_day', 'created_at']),
        ]

    def __str__(self):
        return f'{self.program_day} - {self.get_meal_type_display()}'

    @property
    def recognized_ingredients_list(self) -> list[str]:
        """Возвращает список названий распознанных ингредиентов."""
        if isinstance(self.recognized_ingredients, list):
            return [
                ing.get('name', ing) if isinstance(ing, dict) else str(ing)
                for ing in self.recognized_ingredients
            ]
        return []
