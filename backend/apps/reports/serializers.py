from rest_framework import serializers

from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    pdf_url = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            'id', 'client', 'client_name', 'report_type',
            'period_start', 'period_end',
            'content', 'summary', 'pdf_url',
            'is_sent', 'created_at',
        ]
        read_only_fields = fields

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None

    def get_client_name(self, obj):
        return f'{obj.client.first_name} {obj.client.last_name}'.strip()


class ReportListSerializer(serializers.ModelSerializer):
    """Lightweight serializer without full content."""
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            'id', 'client', 'client_name', 'report_type',
            'period_start', 'period_end',
            'summary', 'is_sent', 'created_at',
        ]

    def get_client_name(self, obj):
        return f'{obj.client.first_name} {obj.client.last_name}'.strip()
