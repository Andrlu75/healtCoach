from rest_framework import serializers

from .models import Meal


class MealSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meal
        fields = [
            'id', 'image', 'image_type', 'dish_name', 'dish_type',
            'calories', 'proteins', 'fats', 'carbohydrates',
            'ingredients', 'ai_confidence', 'meal_time', 'created_at',
        ]
        read_only_fields = fields
