from datetime import date

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client

from .models import Report
from .serializers import ReportListSerializer, ReportSerializer
from .services import generate_report


class ReportListView(APIView):
    """List reports with filters."""

    def get(self, request):
        coach = request.user.coach_profile
        client_id = request.query_params.get('client_id')
        report_type = request.query_params.get('type')

        queryset = Report.objects.filter(coach=coach).select_related('client')

        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if report_type:
            queryset = queryset.filter(report_type=report_type)

        reports = queryset[:50]
        serializer = ReportListSerializer(reports, many=True)
        return Response(serializer.data)


class ReportDetailView(APIView):
    """Get full report details."""

    def get(self, request, pk):
        coach = request.user.coach_profile
        try:
            report = Report.objects.select_related('client').get(pk=pk, coach=coach)
        except Report.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = ReportSerializer(report, context={'request': request})
        return Response(serializer.data)


class ReportGenerateView(APIView):
    """Manually generate a report."""

    def post(self, request):
        coach = request.user.coach_profile
        client_id = request.data.get('client_id')
        report_type = request.data.get('type', 'daily')
        date_str = request.data.get('date')

        if not client_id:
            return Response(
                {'error': 'client_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if report_type not in ('daily', 'weekly'):
            return Response(
                {'error': 'type must be daily or weekly'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_date = None
        if date_str:
            try:
                target_date = date.fromisoformat(date_str)
            except ValueError:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        report = generate_report(client, report_type, target_date)
        serializer = ReportSerializer(report, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
