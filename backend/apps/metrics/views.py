from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client

from .models import HealthMetric
from .serializers import HealthMetricCreateSerializer, HealthMetricSerializer


class HealthMetricListView(APIView):
    """List and create health metrics."""

    def get(self, request):
        coach = request.user.coach_profile
        client_id = request.query_params.get('client_id')
        metric_type = request.query_params.get('type')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        queryset = HealthMetric.objects.filter(client__coach=coach)

        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if metric_type:
            queryset = queryset.filter(metric_type=metric_type)
        if date_from:
            queryset = queryset.filter(recorded_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(recorded_at__date__lte=date_to)

        metrics = queryset[:100]
        serializer = HealthMetricSerializer(metrics, many=True)
        return Response(serializer.data)

    def post(self, request):
        """Manually add a health metric."""
        coach = request.user.coach_profile
        serializer = HealthMetricCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        client_id = serializer.validated_data.pop('client_id')
        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        metric = HealthMetric.objects.create(
            client=client,
            source='manual',
            **serializer.validated_data,
        )
        return Response(
            HealthMetricSerializer(metric).data,
            status=status.HTTP_201_CREATED,
        )
