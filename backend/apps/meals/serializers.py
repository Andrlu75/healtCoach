from rest_framework import serializers

from .models import Meal


class MealSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meal
        fields = [
            'id', 'image', 'thumbnail', 'image_type', 'dish_name', 'dish_type',
            'calories', 'proteins', 'fats', 'carbohydrates',
            'ingredients', 'ai_confidence', 'meal_time', 'created_at',
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
