from rest_framework import serializers

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


class MealSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meal
        fields = [
            'id', 'image', 'thumbnail', 'image_type', 'dish_name', 'dish_type',
            'calories', 'proteins', 'fats', 'carbohydrates',
            'ingredients', 'ai_confidence', 'ai_comment', 'meal_time', 'created_at',
        ]
        read_only_fields = fields


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
