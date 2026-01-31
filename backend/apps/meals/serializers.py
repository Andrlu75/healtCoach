from rest_framework import serializers

from core.validators import validate_uploaded_image
from .models import Meal, MealDraft


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
