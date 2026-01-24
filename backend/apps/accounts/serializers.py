from rest_framework import serializers
from .models import User, Coach, Client


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role']
        read_only_fields = ['id', 'role']


class CoachSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Coach
        fields = ['id', 'user', 'telegram_user_id', 'business_name', 'timezone', 'created_at']
        read_only_fields = ['id', 'created_at']


class ClientSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id', 'telegram_user_id', 'telegram_username',
            'first_name', 'last_name', 'full_name',
            'city', 'timezone', 'status',
            'daily_calories', 'daily_proteins', 'daily_fats', 'daily_carbs', 'daily_water',
            'onboarding_completed', 'onboarding_data',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'telegram_user_id', 'created_at', 'updated_at']

    def get_full_name(self, obj):
        return f'{obj.first_name} {obj.last_name}'.strip()


class ClientDetailSerializer(ClientSerializer):
    meals_count = serializers.SerializerMethodField()
    last_activity = serializers.SerializerMethodField()

    class Meta(ClientSerializer.Meta):
        fields = ClientSerializer.Meta.fields + ['meals_count', 'last_activity']

    def get_meals_count(self, obj):
        return obj.meals.count()

    def get_last_activity(self, obj):
        last_msg = obj.messages.first()
        return last_msg.created_at if last_msg else None
