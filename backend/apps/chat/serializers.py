from rest_framework import serializers

from .models import ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = [
            'id', 'client', 'role', 'message_type',
            'content', 'created_at',
        ]
        read_only_fields = fields
