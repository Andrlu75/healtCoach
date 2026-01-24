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

    class Meta:
        model = InteractionLog
        fields = [
            'id', 'client', 'client_name', 'interaction_type',
            'client_input', 'ai_request', 'ai_response', 'client_output',
            'provider', 'model', 'duration_ms', 'created_at',
        ]
        read_only_fields = fields

    def get_client_name(self, obj):
        name = f'{obj.client.first_name} {obj.client.last_name}'.strip()
        return name or str(obj.client)
