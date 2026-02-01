import uuid
from decimal import Decimal
from io import BytesIO
from typing import TYPE_CHECKING

from django.core.files.base import ContentFile
from django.db import models
from django.core.validators import MinValueValidator
from PIL import Image

if TYPE_CHECKING:
    from apps.accounts.models import Coach


# ============================================================================
# PRODUCT CATEGORIES
# ============================================================================

PRODUCT_CATEGORIES = [
    ('dairy', 'Молочные продукты'),
    ('meat', 'Мясо'),
    ('fish', 'Рыба и морепродукты'),
    ('vegetables', 'Овощи'),
    ('fruits', 'Фрукты'),
    ('grains', 'Крупы и злаки'),
    ('nuts', 'Орехи и семена'),
    ('oils', 'Масла и жиры'),
    ('spices', 'Специи и приправы'),
    ('other', 'Прочее'),
]


# ============================================================================
# PRODUCT MODEL
# ============================================================================

class Product(models.Model):
    """База продуктов коуча с КБЖУ на 100г.

    Продукты переиспользуются в разных блюдах как ингредиенты.
    Каждый коуч имеет свою базу продуктов.
    """

    coach: 'models.ForeignKey[Coach]' = models.ForeignKey(
        'accounts.Coach',
        on_delete=models.CASCADE,
        related_name='products',
        verbose_name='Коуч',
    )
    name = models.CharField(
        max_length=255,
        verbose_name='Название продукта',
    )

    # КБЖУ на 100 грамм
    calories_per_100g = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Калории на 100г',
    )
    proteins_per_100g = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Белки на 100г',
    )
    fats_per_100g = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Жиры на 100г',
    )
    carbs_per_100g = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Углеводы на 100г',
    )

    category = models.CharField(
        max_length=50,
        choices=PRODUCT_CATEGORIES,
        default='other',
        verbose_name='Категория',
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name='Проверено',
        help_text='Подтверждено коучем после AI-подсказки',
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')

    class Meta:
        db_table = 'products'
        unique_together = ['coach', 'name']
        ordering = ['name']
        verbose_name = 'Продукт'
        verbose_name_plural = 'Продукты'
        indexes = [
            models.Index(fields=['coach', 'name']),
            models.Index(fields=['category']),
        ]

    def __str__(self) -> str:
        return self.name

    def get_nutrition_for_weight(self, weight_grams: int) -> dict[str, Decimal]:
        """Рассчитать КБЖУ для заданного веса в граммах.

        Args:
            weight_grams: Вес порции в граммах.

        Returns:
            Словарь с КБЖУ для указанного веса.
        """
        multiplier = Decimal(weight_grams) / Decimal('100')
        return {
            'calories': round(self.calories_per_100g * multiplier, 2),
            'proteins': round(self.proteins_per_100g * multiplier, 2),
            'fats': round(self.fats_per_100g * multiplier, 2),
            'carbohydrates': round(self.carbs_per_100g * multiplier, 2),
        }


# ============================================================================
# DISH TAG MODEL
# ============================================================================

class DishTag(models.Model):
    """Тег для категоризации блюд.

    Коуч создаёт свои теги для удобной организации и фильтрации блюд.
    Например: "Низкоуглеводные", "Веганские", "Быстрые рецепты".
    """

    coach: 'models.ForeignKey[Coach]' = models.ForeignKey(
        'accounts.Coach',
        on_delete=models.CASCADE,
        related_name='dish_tags',
        verbose_name='Коуч',
    )
    name = models.CharField(
        max_length=50,
        verbose_name='Название тега',
    )
    color = models.CharField(
        max_length=7,
        default='#3B82F6',
        verbose_name='Цвет',
        help_text='HEX-код цвета для отображения (например, #3B82F6)',
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')

    class Meta:
        db_table = 'dish_tags'
        unique_together = ['coach', 'name']
        ordering = ['name']
        verbose_name = 'Тег блюда'
        verbose_name_plural = 'Теги блюд'
        indexes = [
            models.Index(fields=['coach']),
        ]

    def __str__(self) -> str:
        return self.name


# ============================================================================
# MEAL TYPES
# ============================================================================

MEAL_TYPES = [
    ('breakfast', 'Завтрак'),
    ('snack1', 'Перекус 1'),
    ('lunch', 'Обед'),
    ('snack2', 'Перекус 2'),
    ('dinner', 'Ужин'),
]


# ============================================================================
# DISH MODEL
# ============================================================================

class Dish(models.Model):
    """Блюдо из базы данных коуча.

    Блюда сохраняются в личной базе коуча и могут использоваться
    при составлении программ питания для клиентов.
    """

    coach: 'models.ForeignKey[Coach]' = models.ForeignKey(
        'accounts.Coach',
        on_delete=models.CASCADE,
        related_name='dishes',
        verbose_name='Коуч',
    )

    # Основная информация
    name = models.CharField(
        max_length=255,
        verbose_name='Название блюда',
    )
    description = models.TextField(
        blank=True,
        verbose_name='Описание',
        help_text='Краткое описание блюда',
    )
    recipe = models.TextField(
        blank=True,
        verbose_name='Рецепт',
        help_text='Пошаговый рецепт приготовления (поддерживает Markdown)',
    )

    # КБЖУ
    portion_weight = models.PositiveIntegerField(
        default=0,
        verbose_name='Вес порции (г)',
    )
    calories = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Калории',
    )
    proteins = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Белки',
    )
    fats = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Жиры',
    )
    carbohydrates = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name='Углеводы',
    )

    # Время приготовления
    cooking_time = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Время приготовления (мин)',
    )

    # Медиа
    photo = models.ImageField(
        upload_to='dishes/%Y/%m/',
        blank=True,
        verbose_name='Фото блюда',
    )
    video_url = models.URLField(
        blank=True,
        verbose_name='Ссылка на видео',
        help_text='Ссылка на видео-рецепт (YouTube, etc.)',
    )

    # JSON поля
    ingredients = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Ингредиенты',
        help_text='Список ингредиентов: [{product_id, name, weight, calories, proteins, fats, carbohydrates}]',
    )
    shopping_links = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Ссылки на покупку',
        help_text='Ссылки на магазины: [{title, url}]',
    )

    # Категоризация
    meal_types = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Типы приёмов пищи',
        help_text='Для каких приёмов пищи подходит: ["breakfast", "lunch", ...]',
    )
    tags = models.ManyToManyField(
        DishTag,
        related_name='dishes',
        blank=True,
        verbose_name='Теги',
    )

    # Статус
    is_active = models.BooleanField(
        default=True,
        verbose_name='Активно',
        help_text='Неактивные блюда не отображаются в списке',
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')

    class Meta:
        db_table = 'dishes'
        ordering = ['-updated_at']
        verbose_name = 'Блюдо'
        verbose_name_plural = 'Блюда'
        indexes = [
            models.Index(fields=['coach', 'name']),
            models.Index(fields=['coach', 'is_active']),
            models.Index(fields=['-updated_at']),
        ]

    def __str__(self) -> str:
        return self.name

    def recalculate_nutrition(self) -> None:
        """Пересчитать КБЖУ на основе ингредиентов.

        Суммирует КБЖУ всех ингредиентов и обновляет поля блюда.
        Также пересчитывает общий вес порции.
        """
        total_weight = Decimal('0')
        total_calories = Decimal('0')
        total_proteins = Decimal('0')
        total_fats = Decimal('0')
        total_carbs = Decimal('0')

        for ing in self.ingredients:
            total_weight += Decimal(str(ing.get('weight', 0)))
            total_calories += Decimal(str(ing.get('calories', 0)))
            total_proteins += Decimal(str(ing.get('proteins', 0)))
            total_fats += Decimal(str(ing.get('fats', 0)))
            total_carbs += Decimal(str(ing.get('carbohydrates', 0)))

        self.portion_weight = int(total_weight)
        self.calories = round(total_calories, 2)
        self.proteins = round(total_proteins, 2)
        self.fats = round(total_fats, 2)
        self.carbohydrates = round(total_carbs, 2)


class MealDraft(models.Model):
    """Черновик приёма пищи для умного режима.

    Flow:
    1. Пользователь загружает фото
    2. AI анализирует → создаётся MealDraft со статусом 'pending'
    3. Пользователь видит экран подтверждения с возможностью:
       - Изменить название блюда
       - Изменить вес порции
       - Удалить/добавить ингредиенты (AI рассчитывает КБЖУ)
    4. При подтверждении → создаётся Meal, статус 'confirmed'
    """

    STATUS_CHOICES = [
        ('pending', 'Ожидает подтверждения'),
        ('confirmed', 'Подтверждён'),
        ('cancelled', 'Отменён'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='meal_drafts')

    # Фото
    image = models.ImageField(upload_to='meal_drafts/%Y/%m/%d/', blank=True)

    # AI результат
    dish_name = models.CharField(max_length=200, verbose_name='Название блюда')
    dish_type = models.CharField(max_length=50, blank=True, verbose_name='Тип приёма пищи')
    estimated_weight = models.IntegerField(default=0, verbose_name='Оценка веса (г)')
    ai_confidence = models.FloatField(default=0.0, verbose_name='Уверенность AI (0-1)')

    # Ингредиенты (редактируемые)
    # Формат: [{"name": "Свёкла", "weight": 80, "calories": 35, "proteins": 1.2, "fats": 0.1, "carbs": 7.6, "is_ai_detected": true}, ...]
    ingredients = models.JSONField(default=list, verbose_name='Ингредиенты')

    # Итоговое КБЖУ (пересчитывается при изменении ингредиентов)
    calories = models.FloatField(default=0, verbose_name='Калории')
    proteins = models.FloatField(default=0, verbose_name='Белки')
    fats = models.FloatField(default=0, verbose_name='Жиры')
    carbohydrates = models.FloatField(default=0, verbose_name='Углеводы')

    # Статус
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    # Ссылка на финальный Meal (после подтверждения)
    meal = models.OneToOneField('Meal', on_delete=models.SET_NULL, null=True, blank=True, related_name='draft')

    class Meta:
        db_table = 'meal_drafts'
        ordering = ['-created_at']
        verbose_name = 'Черновик приёма пищи'
        verbose_name_plural = 'Черновики приёмов пищи'

    def __str__(self):
        return f'{self.dish_name} ({self.client}) - {self.status}'

    def recalculate_nutrition(self):
        """Пересчитать КБЖУ на основе ингредиентов (округление до целого)."""
        self.calories = round(sum(ing.get('calories', 0) for ing in self.ingredients))
        self.proteins = round(sum(ing.get('proteins', 0) for ing in self.ingredients))
        self.fats = round(sum(ing.get('fats', 0) for ing in self.ingredients))
        # Ингредиенты хранят углеводы как 'carbs'
        self.carbohydrates = round(sum(ing.get('carbs', 0) for ing in self.ingredients))
        # Пересчитываем общий вес
        self.estimated_weight = round(sum(ing.get('weight', 0) for ing in self.ingredients))

    def remove_ingredient(self, index: int):
        """Удалить ингредиент по индексу."""
        if 0 <= index < len(self.ingredients):
            self.ingredients.pop(index)
            self.recalculate_nutrition()

    def scale_by_weight(self, new_weight: int):
        """Пропорционально пересчитать ингредиенты при изменении веса.

        ВАЖНО: Ингредиенты с is_user_edited=True НЕ пересчитываются!
        Пользователь явно указал значения - они фиксированы.

        Например: было 300г, стало 450г → коэффициент 1.5
        → ингредиенты без is_user_edited × 1.5
        → ингредиенты с is_user_edited остаются как есть
        """
        if self.estimated_weight <= 0 or new_weight <= 0:
            return

        # Считаем вес только НЕ отредактированных ингредиентов
        editable_weight = sum(
            ing.get('weight', 0)
            for ing in self.ingredients
            if not ing.get('is_user_edited', False)
        )
        fixed_weight = sum(
            ing.get('weight', 0)
            for ing in self.ingredients
            if ing.get('is_user_edited', False)
        )

        # Целевой вес для редактируемых = новый общий вес - зафиксированный
        target_editable_weight = new_weight - fixed_weight

        if editable_weight > 0 and target_editable_weight > 0:
            ratio = target_editable_weight / editable_weight

            for ing in self.ingredients:
                # Пропускаем зафиксированные пользователем ингредиенты
                if ing.get('is_user_edited', False):
                    continue

                ing['weight'] = round(ing.get('weight', 0) * ratio)
                ing['calories'] = round(ing.get('calories', 0) * ratio)
                ing['proteins'] = round(ing.get('proteins', 0) * ratio)
                ing['fats'] = round(ing.get('fats', 0) * ratio)
                ing['carbs'] = round(ing.get('carbs', 0) * ratio)

        self.estimated_weight = new_weight
        self.recalculate_nutrition()

    def update_ingredient(self, index: int, data: dict):
        """Обновить данные ингредиента по индексу.

        data может содержать: name, weight, calories, proteins, fats, carbs

        Логика:
        - Если меняется только weight (без КБЖУ) → КБЖУ пересчитывается пропорционально
        - Если меняется КБЖУ напрямую → сохраняется как есть, ингредиент фиксируется
        """
        if not (0 <= index < len(self.ingredients)):
            raise ValueError(f'Индекс {index} вне диапазона')

        ing = self.ingredients[index]

        if 'name' in data:
            ing['name'] = data['name']

        # Проверяем, меняется ли только вес (без прямого изменения КБЖУ)
        only_weight_changed = (
            'weight' in data and
            'calories' not in data and
            'proteins' not in data and
            'fats' not in data and
            'carbs' not in data
        )

        if only_weight_changed:
            # Пересчитываем КБЖУ пропорционально новому весу
            old_weight = ing.get('weight', 0)
            new_weight = round(float(data['weight']))

            if old_weight > 0 and new_weight > 0:
                ratio = new_weight / old_weight
                ing['weight'] = new_weight
                ing['calories'] = round(ing.get('calories', 0) * ratio)
                ing['proteins'] = round(ing.get('proteins', 0) * ratio)
                ing['fats'] = round(ing.get('fats', 0) * ratio)
                ing['carbs'] = round(ing.get('carbs', 0) * ratio)
            else:
                ing['weight'] = new_weight
            # НЕ ставим is_user_edited - это автоматический пересчёт
        else:
            # Пользователь меняет КБЖУ напрямую - фиксируем
            if 'weight' in data:
                ing['weight'] = round(float(data['weight']))
            if 'calories' in data:
                ing['calories'] = round(float(data['calories']))
            if 'proteins' in data:
                ing['proteins'] = round(float(data['proteins']))
            if 'fats' in data:
                ing['fats'] = round(float(data['fats']))
            if 'carbs' in data:
                ing['carbs'] = round(float(data['carbs']))

            # Помечаем как отредактированный пользователем - не будет пересчитываться
            ing['is_user_edited'] = True

        self.recalculate_nutrition()


class Meal(models.Model):
    IMAGE_TYPE_CHOICES = [
        ('food', 'Еда'),
        ('data', 'Цифровые данные'),
        ('other', 'Прочее'),
    ]

    THUMBNAIL_SIZE = (300, 300)

    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='meals')
    image = models.ImageField(upload_to='meals/%Y/%m/%d/', blank=True)
    thumbnail = models.ImageField(upload_to='meals/thumbnails/%Y/%m/%d/', blank=True)
    image_type = models.CharField(max_length=10, choices=IMAGE_TYPE_CHOICES, default='food')

    dish_name = models.CharField(max_length=200)
    dish_type = models.CharField(max_length=50, blank=True)
    calories = models.FloatField(null=True, blank=True)
    proteins = models.FloatField(null=True, blank=True)
    fats = models.FloatField(null=True, blank=True)
    carbohydrates = models.FloatField(null=True, blank=True)

    ingredients = models.JSONField(default=list, blank=True)
    health_analysis = models.JSONField(default=dict, blank=True)
    ai_confidence = models.IntegerField(null=True, blank=True)
    ai_comment = models.TextField(blank=True, verbose_name='Комментарий AI')

    PROGRAM_CHECK_STATUS_CHOICES = [
        ('compliant', 'Соответствует'),
        ('violation', 'Нарушение'),
    ]
    program_check_status = models.CharField(
        max_length=20,
        choices=PROGRAM_CHECK_STATUS_CHOICES,
        null=True,
        blank=True,
        verbose_name='Статус проверки программы',
    )

    plate_type = models.CharField(max_length=100, blank=True)
    layout = models.CharField(max_length=200, blank=True)
    decorations = models.CharField(max_length=200, blank=True)

    meal_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meals'
        ordering = ['-meal_time']

    def __str__(self):
        return f'{self.dish_name} ({self.client})'

    def save(self, *args, **kwargs):
        # Generate thumbnail if image exists and thumbnail doesn't
        if self.image and not self.thumbnail:
            self._create_thumbnail()
        super().save(*args, **kwargs)

    def _create_thumbnail(self):
        """Create a thumbnail from the main image."""
        try:
            img = Image.open(self.image)

            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Resize maintaining aspect ratio
            img.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

            # Save to BytesIO
            thumb_io = BytesIO()
            img.save(thumb_io, format='JPEG', quality=85)
            thumb_io.seek(0)

            # Generate thumbnail filename
            thumb_name = f"thumb_{self.image.name.split('/')[-1].rsplit('.', 1)[0]}.jpg"

            # Save to thumbnail field
            self.thumbnail.save(thumb_name, ContentFile(thumb_io.read()), save=False)
        except Exception:
            # If thumbnail creation fails, just continue without it
            pass
