from rest_framework import serializers
from .models import BotPersona, AIProviderConfig, AIModelConfig, AIUsageLog, TelegramBot


class BotPersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotPersona
        fields = [
            'id', 'name', 'age', 'city', 'is_default',
            'style_description', 'system_prompt', 'greeting_message',
            'text_provider', 'text_model',
            'vision_provider', 'vision_model',
            'voice_provider', 'voice_model',
            'temperature', 'max_tokens',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AIProviderConfigSerializer(serializers.ModelSerializer):
    masked_key = serializers.CharField(read_only=True)

    class Meta:
        model = AIProviderConfig
        fields = ['id', 'provider', 'is_active', 'masked_key', 'created_at']
        read_only_fields = ['id', 'created_at']


class AIProviderCreateSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=['openai', 'anthropic', 'deepseek', 'gemini'])
    api_key = serializers.CharField(max_length=300)


class FetchModelsSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=['openai', 'anthropic', 'deepseek', 'gemini'])
    api_key = serializers.CharField(max_length=300, required=False, allow_blank=True)


class AIModelSelectionSerializer(serializers.Serializer):
    text_provider = serializers.CharField(max_length=20, required=False, allow_blank=True)
    text_model = serializers.CharField(max_length=100, required=False, allow_blank=True)
    vision_provider = serializers.CharField(max_length=20, required=False, allow_blank=True)
    vision_model = serializers.CharField(max_length=100, required=False, allow_blank=True)
    voice_provider = serializers.CharField(max_length=20, required=False, allow_blank=True)
    voice_model = serializers.CharField(max_length=100, required=False, allow_blank=True)
    temperature = serializers.FloatField(min_value=0, max_value=2, required=False)
    max_tokens = serializers.IntegerField(min_value=100, max_value=4000, required=False)


class AIModelConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIModelConfig
        fields = ['id', 'provider', 'model_id', 'model_name', 'created_at']
        read_only_fields = ['id', 'created_at']


class AIModelAddSerializer(serializers.Serializer):
    models = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
    )

    def validate_models(self, value):
        for item in value:
            if not item.get('provider') or not item.get('model_id') or not item.get('model_name'):
                raise serializers.ValidationError(
                    'Каждая модель должна содержать provider, model_id и model_name'
                )
            if item['provider'] not in ['openai', 'anthropic', 'deepseek', 'gemini']:
                raise serializers.ValidationError(f'Неизвестный провайдер: {item["provider"]}')
        return value


class AIUsageStatsSerializer(serializers.Serializer):
    provider = serializers.CharField()
    model = serializers.CharField()
    task_type = serializers.CharField()
    requests_count = serializers.IntegerField()
    total_input_tokens = serializers.IntegerField()
    total_output_tokens = serializers.IntegerField()
    total_cost_usd = serializers.DecimalField(max_digits=10, decimal_places=6)


class TelegramBotSerializer(serializers.ModelSerializer):
    masked_token = serializers.CharField(read_only=True)

    class Meta:
        model = TelegramBot
        fields = ['id', 'name', 'masked_token', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class TelegramBotCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    token = serializers.CharField(max_length=100)


class TelegramSettingsSerializer(serializers.Serializer):
    notification_chat_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
