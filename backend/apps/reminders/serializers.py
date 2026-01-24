from rest_framework import serializers

from .models import Reminder


class ReminderSerializer(serializers.ModelSerializer):
    reminder_type_display = serializers.CharField(
        source='get_reminder_type_display', read_only=True
    )
    frequency_display = serializers.CharField(
        source='get_frequency_display', read_only=True
    )

    class Meta:
        model = Reminder
        fields = [
            'id', 'client', 'title', 'message',
            'reminder_type', 'reminder_type_display',
            'frequency', 'frequency_display',
            'time', 'days_of_week',
            'is_active', 'is_smart',
            'last_sent_at', 'next_fire_at', 'created_at',
        ]
        read_only_fields = ['id', 'last_sent_at', 'next_fire_at', 'created_at']


class ReminderCreateSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    title = serializers.CharField(max_length=200)
    message = serializers.CharField(required=False, default='', allow_blank=True)
    reminder_type = serializers.ChoiceField(
        choices=['meal', 'water', 'workout', 'weigh_in', 'custom'],
        default='meal',
    )
    frequency = serializers.ChoiceField(
        choices=['once', 'daily', 'weekly', 'custom'],
        default='daily',
    )
    time = serializers.TimeField()
    days_of_week = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=7),
        required=False, default=list,
    )
    is_active = serializers.BooleanField(default=True)
    is_smart = serializers.BooleanField(default=False)
