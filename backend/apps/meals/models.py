import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from django.db import models
from PIL import Image


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
