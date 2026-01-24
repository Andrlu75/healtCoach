from rest_framework import serializers

from .models import HealthMetric


class HealthMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthMetric
        fields = [
            'id', 'client', 'metric_type', 'value', 'unit',
            'notes', 'source', 'recorded_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class HealthMetricCreateSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    metric_type = serializers.ChoiceField(
        choices=['weight', 'sleep', 'steps', 'heart_rate', 'blood_pressure', 'water', 'custom']
    )
    value = serializers.FloatField()
    unit = serializers.CharField(max_length=20)
    notes = serializers.CharField(required=False, default='', allow_blank=True)
    recorded_at = serializers.DateTimeField()
