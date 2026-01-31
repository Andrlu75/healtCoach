"""Coach API views for managing client integrations."""
import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GoogleFitConnection, GoogleFitSyncLog, HuaweiHealthConnection, HuaweiHealthSyncLog
from .tasks import sync_google_fit_for_client

logger = logging.getLogger(__name__)


class IntegrationsOverviewView(APIView):
    """Get overview of all client integrations for the coach."""

    def get(self, request):
        coach = request.user.coach_profile

        # Get all clients with their integration status
        from apps.accounts.models import Client
        clients = Client.objects.filter(coach=coach, status='active').order_by('first_name')

        result = []
        for client in clients:
            client_data = {
                'client_id': client.id,
                'client_name': f"{client.first_name or ''} {client.last_name or ''}".strip() or f"Клиент #{client.id}",
                'integrations': []
            }

            # Google Fit
            try:
                gf = client.google_fit_connection
                # Get last sync log
                last_log = GoogleFitSyncLog.objects.filter(connection=gf).first()
                client_data['integrations'].append({
                    'type': 'google_fit',
                    'name': 'Google Fit',
                    'connected': gf.is_active,
                    'last_sync_at': gf.last_sync_at,
                    'has_error': bool(gf.last_error),
                    'error_message': gf.last_error if gf.error_count > 0 else None,
                    'error_count': gf.error_count,
                    'last_sync_status': last_log.status if last_log else None,
                    'metrics_synced': last_log.metrics_synced if last_log else None,
                })
            except GoogleFitConnection.DoesNotExist:
                client_data['integrations'].append({
                    'type': 'google_fit',
                    'name': 'Google Fit',
                    'connected': False,
                })

            # Huawei Health
            try:
                hh = client.huawei_health_connection
                last_log = HuaweiHealthSyncLog.objects.filter(connection=hh).first()
                client_data['integrations'].append({
                    'type': 'huawei_health',
                    'name': 'Huawei Health',
                    'connected': hh.is_active,
                    'last_sync_at': hh.last_sync_at,
                    'has_error': bool(hh.last_error),
                    'error_message': hh.last_error if hh.error_count > 0 else None,
                    'error_count': hh.error_count,
                    'last_sync_status': last_log.status if last_log else None,
                    'metrics_synced': last_log.metrics_synced if last_log else None,
                })
            except HuaweiHealthConnection.DoesNotExist:
                client_data['integrations'].append({
                    'type': 'huawei_health',
                    'name': 'Huawei Health',
                    'connected': False,
                })

            result.append(client_data)

        # Summary counts
        google_fit_count = GoogleFitConnection.objects.filter(
            client__coach=coach, is_active=True
        ).count()
        huawei_health_count = HuaweiHealthConnection.objects.filter(
            client__coach=coach, is_active=True
        ).count()

        return Response({
            'clients': result,
            'summary': {
                'google_fit_active': google_fit_count,
                'huawei_health_active': huawei_health_count,
                'total_clients': clients.count(),
            }
        })


class TriggerSyncView(APIView):
    """Manually trigger sync for a client's integration."""

    def post(self, request):
        coach = request.user.coach_profile
        client_id = request.data.get('client_id')
        integration_type = request.data.get('integration_type')

        if not client_id or not integration_type:
            return Response(
                {'error': 'client_id and integration_type are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify client belongs to coach
        from apps.accounts.models import Client
        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

        if integration_type == 'google_fit':
            try:
                connection = client.google_fit_connection
                if not connection.is_active:
                    return Response(
                        {'error': 'Google Fit connection is not active'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                sync_google_fit_for_client.delay(client.pk)
                return Response({'status': 'sync_started', 'integration': 'google_fit'})
            except GoogleFitConnection.DoesNotExist:
                return Response(
                    {'error': 'Google Fit not connected'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        elif integration_type == 'huawei_health':
            try:
                connection = client.huawei_health_connection
                if not connection.is_active:
                    return Response(
                        {'error': 'Huawei Health connection is not active'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                # Import and call Huawei sync task
                from .huawei_tasks import sync_huawei_health_for_client
                sync_huawei_health_for_client.delay(client.pk)
                return Response({'status': 'sync_started', 'integration': 'huawei_health'})
            except HuaweiHealthConnection.DoesNotExist:
                return Response(
                    {'error': 'Huawei Health not connected'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return Response(
            {'error': f'Unknown integration type: {integration_type}'},
            status=status.HTTP_400_BAD_REQUEST
        )


class DisconnectIntegrationView(APIView):
    """Disconnect a client's integration."""

    def post(self, request):
        coach = request.user.coach_profile
        client_id = request.data.get('client_id')
        integration_type = request.data.get('integration_type')

        if not client_id or not integration_type:
            return Response(
                {'error': 'client_id and integration_type are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify client belongs to coach
        from apps.accounts.models import Client
        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

        if integration_type == 'google_fit':
            try:
                connection = client.google_fit_connection
                connection.delete()
                logger.info('Coach %s disconnected Google Fit for client %s', coach.pk, client.pk)
                return Response({'status': 'disconnected', 'integration': 'google_fit'})
            except GoogleFitConnection.DoesNotExist:
                return Response({'status': 'not_connected'})

        elif integration_type == 'huawei_health':
            try:
                connection = client.huawei_health_connection
                connection.delete()
                logger.info('Coach %s disconnected Huawei Health for client %s', coach.pk, client.pk)
                return Response({'status': 'disconnected', 'integration': 'huawei_health'})
            except HuaweiHealthConnection.DoesNotExist:
                return Response({'status': 'not_connected'})

        return Response(
            {'error': f'Unknown integration type: {integration_type}'},
            status=status.HTTP_400_BAD_REQUEST
        )


class SyncLogsView(APIView):
    """Get sync logs for a client's integration."""

    def get(self, request):
        coach = request.user.coach_profile
        client_id = request.query_params.get('client_id')
        integration_type = request.query_params.get('integration_type')

        if not client_id or not integration_type:
            return Response(
                {'error': 'client_id and integration_type are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify client belongs to coach
        from apps.accounts.models import Client
        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

        logs = []
        if integration_type == 'google_fit':
            try:
                connection = client.google_fit_connection
                for log in connection.sync_logs.all()[:20]:
                    logs.append({
                        'id': log.id,
                        'started_at': log.started_at,
                        'finished_at': log.finished_at,
                        'status': log.status,
                        'metrics_synced': log.metrics_synced,
                        'error_message': log.error_message,
                    })
            except GoogleFitConnection.DoesNotExist:
                pass

        elif integration_type == 'huawei_health':
            try:
                connection = client.huawei_health_connection
                for log in connection.sync_logs.all()[:20]:
                    logs.append({
                        'id': log.id,
                        'started_at': log.started_at,
                        'finished_at': log.finished_at,
                        'status': log.status,
                        'metrics_synced': log.metrics_synced,
                        'error_message': log.error_message,
                    })
            except HuaweiHealthConnection.DoesNotExist:
                pass

        return Response({'logs': logs})
