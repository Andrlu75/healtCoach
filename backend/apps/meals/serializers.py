import json
import re
from decimal import Decimal
from urllib.parse import urlparse

from rest_framework import serializers

from core.validators import validate_uploaded_image
from .models import Dish, DishTag, Meal, MealDraft, Product, MEAL_TYPES


# ============================================================================
# SECURITY CONSTANTS
# ============================================================================

# Лимиты для защиты от DoS через большие JSON payloads
MAX_INGREDIENTS = 50
MAX_SHOPPING_LINKS = 20
MAX_MEAL_TYPES = 5
MAX_STRING_LENGTH = 500

# Разрешённые URL схемы для ссылок
ALLOWED_URL_SCHEMES = {'http', 'https'}


class IngredientSerializer(serializers.Serializer):
    """Сериализатор для ингредиента в черновике."""
    name = serializers.CharField()
    weight = serializers.FloatField()
    calories = serializers.FloatField()
    proteins = serializers.FloatField()
    fats = serializers.FloatField()
    carbs = serializers.FloatField()
    is_ai_detected = serializers.BooleanField(default=True)
    is_user_edited = serializers.BooleanField(default=False)  # Зафиксирован пользователем


class MealDraftSerializer(serializers.ModelSerializer):
    """Сериализатор для черновика приёма пищи."""
    ingredients = IngredientSerializer(many=True, read_only=True)

    class Meta:
        model = MealDraft
        fields = [
            'id', 'dish_name', 'dish_type', 'estimated_weight', 'ai_confidence',
            'ingredients', 'calories', 'proteins', 'fats', 'carbohydrates',
            'status', 'created_at', 'confirmed_at', 'image',
        ]
        read_only_fields = fields


class MealDraftUpdateSerializer(serializers.Serializer):
    """Сериализатор для обновления черновика."""
    dish_name = serializers.CharField(required=False)
    dish_type = serializers.CharField(required=False)
    estimated_weight = serializers.IntegerField(required=False)


class AddIngredientSerializer(serializers.Serializer):
    """Сериализатор для добавления ингредиента."""
    name = serializers.CharField()


class ComplianceStatusSerializer(serializers.Serializer):
    """Сериализатор для статуса соблюдения программы питания."""
    is_compliant = serializers.BooleanField()
    found_forbidden = serializers.ListField(child=serializers.CharField())
    ai_comment = serializers.CharField()


class MealSerializer(serializers.ModelSerializer):
    compliance_status = serializers.SerializerMethodField()

    class Meta:
        model = Meal
        fields = [
            'id', 'image', 'thumbnail', 'image_type', 'dish_name', 'dish_type',
            'calories', 'proteins', 'fats', 'carbohydrates',
            'ingredients', 'ai_confidence', 'ai_comment', 'meal_time', 'created_at',
            'compliance_status',
        ]
        read_only_fields = fields

    def get_compliance_status(self, obj):
        """Возвращает статус соблюдения программы питания."""
        check = obj.compliance_checks.first()
        if not check:
            return None
        return {
            'is_compliant': check.is_compliant,
            'found_forbidden': check.found_forbidden,
            'ai_comment': check.ai_comment,
        }


class MealCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating meals from miniapp."""

    class Meta:
        model = Meal
        fields = [
            'id', 'client', 'image', 'image_type', 'dish_name', 'dish_type',
            'calories', 'proteins', 'fats', 'carbohydrates', 'ingredients',
            'ai_confidence', 'meal_time',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'image': {'required': False},
            'ingredients': {'required': False},
            'ai_confidence': {'required': False},
        }

    def validate_image(self, value):
        """Валидация загружаемого изображения."""
        if value:
            validate_uploaded_image(value)
        return value


# ============================================================================
# PRODUCT SERIALIZERS
# ============================================================================

class ProductSerializer(serializers.ModelSerializer):
    """Сериализатор для модели Product.

    Используется для CRUD операций с продуктами коуча.
    """

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'calories_per_100g',
            'proteins_per_100g',
            'fats_per_100g',
            'carbs_per_100g',
            'category',
            'is_verified',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_calories_per_100g(self, value: Decimal) -> Decimal:
        """Валидация калорий."""
        if value < 0:
            raise serializers.ValidationError('Калории не могут быть отрицательными.')
        return value

    def validate_proteins_per_100g(self, value: Decimal) -> Decimal:
        """Валидация белков."""
        if value < 0:
            raise serializers.ValidationError('Белки не могут быть отрицательными.')
        return value

    def validate_fats_per_100g(self, value: Decimal) -> Decimal:
        """Валидация жиров."""
        if value < 0:
            raise serializers.ValidationError('Жиры не могут быть отрицательными.')
        return value

    def validate_carbs_per_100g(self, value: Decimal) -> Decimal:
        """Валидация углеводов."""
        if value < 0:
            raise serializers.ValidationError('Углеводы не могут быть отрицательными.')
        return value


# ============================================================================
# DISH TAG SERIALIZERS
# ============================================================================

class DishTagSerializer(serializers.ModelSerializer):
    """Сериализатор для модели DishTag."""

    class Meta:
        model = DishTag
        fields = ['id', 'name', 'color', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_color(self, value: str) -> str:
        """Валидация HEX цвета."""
        if not re.match(r'^#[0-9A-Fa-f]{6}$', value):
            raise serializers.ValidationError(
                'Цвет должен быть в формате HEX (#RRGGBB).'
            )
        return value.upper()


# ============================================================================
# DISH SERIALIZERS
# ============================================================================

class DishIngredientSerializer(serializers.Serializer):
    """Сериализатор для ингредиента в блюде."""

    product_id = serializers.IntegerField(required=False, allow_null=True)
    name = serializers.CharField(max_length=255)
    weight = serializers.IntegerField(min_value=0)
    calories = serializers.DecimalField(max_digits=7, decimal_places=2, min_value=0)
    proteins = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0)
    fats = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0)
    carbohydrates = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0)


class ShoppingLinkSerializer(serializers.Serializer):
    """Сериализатор для ссылки на покупку."""

    title = serializers.CharField(max_length=255)
    url = serializers.URLField()

    def validate_url(self, value: str) -> str:
        """Валидация URL схемы для защиты от XSS (javascript:, data:)."""
        parsed = urlparse(value)
        if parsed.scheme.lower() not in ALLOWED_URL_SCHEMES:
            raise serializers.ValidationError(
                f'Недопустимая схема URL: {parsed.scheme}. '
                f'Разрешены только: {", ".join(ALLOWED_URL_SCHEMES)}.'
            )
        return value


class DishListSerializer(serializers.ModelSerializer):
    """Компактный сериализатор для списка блюд."""

    tags = DishTagSerializer(many=True, read_only=True)

    class Meta:
        model = Dish
        fields = [
            'id',
            'name',
            'photo',
            'calories',
            'proteins',
            'fats',
            'carbohydrates',
            'portion_weight',
            'meal_types',
            'tags',
            'cooking_time',
            'updated_at',
        ]
        read_only_fields = fields


class DishDetailSerializer(serializers.ModelSerializer):
    """Полный сериализатор для детального просмотра и редактирования блюда."""

    tags = DishTagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text='Список ID тегов для привязки к блюду',
    )

    class Meta:
        model = Dish
        fields = [
            'id',
            'name',
            'description',
            'recipe',
            'portion_weight',
            'calories',
            'proteins',
            'fats',
            'carbohydrates',
            'cooking_time',
            'photo',
            'video_url',
            'ingredients',
            'shopping_links',
            'meal_types',
            'tags',
            'tag_ids',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_ingredients(self, value) -> list:
        """Валидация структуры ингредиентов с защитой от DoS."""
        # Парсинг JSON-строки (при отправке через FormData)
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError('Неверный формат JSON для ингредиентов.')

        if not isinstance(value, list):
            raise serializers.ValidationError('Ингредиенты должны быть списком.')

        if len(value) > MAX_INGREDIENTS:
            raise serializers.ValidationError(
                f'Превышен лимит ингредиентов: максимум {MAX_INGREDIENTS}.'
            )

        serializer = DishIngredientSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return value

    def validate_shopping_links(self, value) -> list:
        """Валидация структуры ссылок на покупку с защитой от DoS."""
        # Парсинг JSON-строки (при отправке через FormData)
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError('Неверный формат JSON для ссылок.')

        if not isinstance(value, list):
            raise serializers.ValidationError('Ссылки должны быть списком.')

        if len(value) > MAX_SHOPPING_LINKS:
            raise serializers.ValidationError(
                f'Превышен лимит ссылок: максимум {MAX_SHOPPING_LINKS}.'
            )

        serializer = ShoppingLinkSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return value

    def validate_meal_types(self, value) -> list:
        """Валидация типов приёмов пищи с защитой от DoS."""
        # Парсинг JSON-строки (при отправке через FormData)
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError('Неверный формат JSON для типов приёмов пищи.')

        if not isinstance(value, list):
            raise serializers.ValidationError('Типы приёмов пищи должны быть списком.')

        if len(value) > MAX_MEAL_TYPES:
            raise serializers.ValidationError(
                f'Превышен лимит типов приёмов пищи: максимум {MAX_MEAL_TYPES}.'
            )

        valid_types = {mt[0] for mt in MEAL_TYPES}
        for meal_type in value:
            if meal_type not in valid_types:
                raise serializers.ValidationError(
                    f'Недопустимый тип приёма пищи: {meal_type}. '
                    f'Допустимые значения: {", ".join(valid_types)}.'
                )
        return value

    def create(self, validated_data: dict) -> Dish:
        """Создание блюда с привязкой тегов."""
        tag_ids = validated_data.pop('tag_ids', [])
        request = self.context.get('request')

        # Устанавливаем coach из request
        if request and hasattr(request, 'user') and hasattr(request.user, 'coach_profile'):
            validated_data['coach'] = request.user.coach_profile

        dish = Dish.objects.create(**validated_data)

        # Привязываем теги
        if tag_ids:
            tags = DishTag.objects.filter(
                id__in=tag_ids,
                coach=dish.coach,
            )
            dish.tags.set(tags)

        return dish

    def update(self, instance: Dish, validated_data: dict) -> Dish:
        """Обновление блюда с обработкой тегов."""
        tag_ids = validated_data.pop('tag_ids', None)

        # Обновляем поля
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Обновляем теги если переданы
        if tag_ids is not None:
            tags = DishTag.objects.filter(
                id__in=tag_ids,
                coach=instance.coach,
            )
            instance.tags.set(tags)

        return instance


# ============================================================================
# DISH EXPORT/IMPORT SERIALIZERS
# ============================================================================

class DishExportSerializer(serializers.ModelSerializer):
    """Сериализатор для экспорта блюд в JSON.

    Экспортирует все данные блюда кроме coach, photo и thumbnail.
    Теги экспортируются по названию для возможности импорта.
    """

    tags = serializers.SerializerMethodField()

    class Meta:
        model = Dish
        fields = [
            'name',
            'description',
            'recipe',
            'portion_weight',
            'calories',
            'proteins',
            'fats',
            'carbohydrates',
            'cooking_time',
            'video_url',
            'ingredients',
            'shopping_links',
            'meal_types',
            'tags',
            'is_active',
        ]

    def get_tags(self, obj: Dish) -> list[str]:
        """Возвращает список названий тегов."""
        return list(obj.tags.values_list('name', flat=True))


class DishImportItemSerializer(serializers.Serializer):
    """Сериализатор для одного импортируемого блюда."""

    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    recipe = serializers.CharField(required=False, allow_blank=True, default='')
    portion_weight = serializers.IntegerField(required=False, default=0, min_value=0)
    calories = serializers.DecimalField(
        max_digits=7, decimal_places=2, required=False, default=Decimal('0'),
        min_value=Decimal('0'),
    )
    proteins = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, default=Decimal('0'),
        min_value=Decimal('0'),
    )
    fats = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, default=Decimal('0'),
        min_value=Decimal('0'),
    )
    carbohydrates = serializers.DecimalField(
        max_digits=6, decimal_places=2, required=False, default=Decimal('0'),
        min_value=Decimal('0'),
    )
    cooking_time = serializers.IntegerField(required=False, allow_null=True, default=None)
    video_url = serializers.URLField(required=False, allow_blank=True, default='')
    ingredients = serializers.ListField(required=False, default=list)
    shopping_links = serializers.ListField(required=False, default=list)
    meal_types = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    is_active = serializers.BooleanField(required=False, default=True)

    def validate_meal_types(self, value: list) -> list:
        """Валидация типов приёмов пищи."""
        valid_types = {mt[0] for mt in MEAL_TYPES}
        return [mt for mt in value if mt in valid_types]


class DishImportSerializer(serializers.Serializer):
    """Сериализатор для импорта блюд из JSON."""

    dishes = DishImportItemSerializer(many=True)

    def validate_dishes(self, value: list) -> list:
        """Проверка что есть хотя бы одно блюдо."""
        if not value:
            raise serializers.ValidationError('Список блюд не может быть пустым.')
        return value
