from rest_framework import serializers
from .models import BotPersona


class BotPersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotPersona
        fields = [
            'id', 'name', 'age', 'city',
            'style_description', 'system_prompt', 'greeting_message',
            'ai_provider', 'ai_model_chat', 'ai_model_vision',
            'temperature', 'max_tokens',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AISettingsSerializer(serializers.Serializer):
    ai_provider = serializers.ChoiceField(choices=['openai', 'anthropic'])
    ai_model_chat = serializers.CharField(max_length=50)
    ai_model_vision = serializers.CharField(max_length=50)
    temperature = serializers.FloatField(min_value=0, max_value=2)
    max_tokens = serializers.IntegerField(min_value=100, max_value=4000)
    openai_api_key = serializers.CharField(max_length=200, required=False, allow_blank=True)
    anthropic_api_key = serializers.CharField(max_length=200, required=False, allow_blank=True)


class TelegramSettingsSerializer(serializers.Serializer):
    bot_token = serializers.CharField(max_length=100, required=False, allow_blank=True)
    webhook_url = serializers.URLField(required=False, allow_blank=True)
    notification_chat_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
