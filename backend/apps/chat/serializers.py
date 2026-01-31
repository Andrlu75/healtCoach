from rest_framework import serializers

from .models import ChatMessage, InteractionLog


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = [
            'id', 'client', 'role', 'message_type',
            'content', 'created_at',
        ]
        read_only_fields = fields


class InteractionLogSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = InteractionLog
        fields = [
            'id', 'client', 'client_name', 'interaction_type',
            'client_input', 'ai_request', 'ai_response', 'client_output',
            'provider', 'model', 'duration_ms', 'created_at', 'image_url',
        ]
        read_only_fields = fields

    def get_client_name(self, obj):
        name = f'{obj.client.first_name} {obj.client.last_name}'.strip()
        return name or str(obj.client)

    def get_image_url(self, obj):
        """Get image URL for vision interactions by finding related Meal.

        NOTE: Этот метод делает отдельный запрос для каждого объекта.
        Для больших списков рассмотрите prefetch через context.
        """
        if obj.interaction_type != 'vision':
            return None

        from apps.meals.models import Meal
        from datetime import timedelta

        # Find meal created within 2 minutes of this interaction
        time_window = timedelta(minutes=2)
        meal = Meal.objects.filter(
            client_id=obj.client_id,  # Используем client_id вместо obj.client
            created_at__gte=obj.created_at - time_window,
            created_at__lte=obj.created_at + time_window,
        ).only('image').first()  # Загружаем только поле image

        if meal and meal.image:
            return meal.image.url
        return None
