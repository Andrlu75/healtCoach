import logging
from datetime import timedelta

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from google_auth_oauthlib.flow import Flow

from apps.bot.client_views import get_client_from_token
from .models import GoogleFitConnection
from .tasks import sync_google_fit_for_client

logger = logging.getLogger(__name__)

GOOGLE_FIT_SCOPES = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.sleep.read',
]


def _get_flow(redirect_uri: str = None) -> Flow:
    """Создаёт OAuth Flow для Google Fit."""
    return Flow.from_client_config(
        {
            'web': {
                'client_id': settings.GOOGLE_FIT_CLIENT_ID,
                'client_secret': settings.GOOGLE_FIT_CLIENT_SECRET,
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
            }
        },
        scopes=GOOGLE_FIT_SCOPES,
        redirect_uri=redirect_uri or settings.GOOGLE_FIT_REDIRECT_URI,
    )


class GoogleFitAuthURLView(APIView):
    """Генерирует URL для OAuth авторизации Google Fit."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        flow = _get_flow()

        # State содержит client_id для связывания после редиректа
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=str(client.pk),
        )

        return Response({
            'auth_url': auth_url,
            'state': state,
        })


class GoogleFitCallbackView(APIView):
    """
    Обрабатывает callback от Google OAuth.
    Возвращает HTML страницу, которая отправляет postMessage и закрывает popup.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get('code')
        state = request.query_params.get('state')
        error = request.query_params.get('error')

        if error:
            logger.warning('Google Fit OAuth error: %s', error)
            return self._render_popup_response(success=False, error=error)

        if not code or not state:
            return self._render_popup_response(success=False, error='missing_params')

        try:
            client_id = int(state)
        except ValueError:
            return self._render_popup_response(success=False, error='invalid_state')

        # Exchange code for tokens
        flow = _get_flow()

        try:
            flow.fetch_token(code=code)
            credentials = flow.credentials
        except Exception as e:
            logger.exception('Google Fit token exchange error: %s', e)
            return self._render_popup_response(success=False, error='token_exchange_failed')

        # Save connection
        from apps.accounts.models import Client
        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return self._render_popup_response(success=False, error='client_not_found')

        try:
            connection, created = GoogleFitConnection.objects.update_or_create(
                client=client,
                defaults={
                    'is_active': True,
                    'scopes': GOOGLE_FIT_SCOPES,
                    'token_expires_at': credentials.expiry or timezone.now() + timedelta(hours=1),
                    'error_count': 0,
                    'last_error': '',
                }
            )
            connection.set_tokens(
                credentials.token,
                credentials.refresh_token or ''
            )
            connection.save()

            logger.info('Google Fit connected for client %s', client_id)

            # Trigger initial sync
            sync_google_fit_for_client.delay(client.pk)

        except Exception as e:
            logger.exception('Error saving Google Fit connection: %s', e)
            return self._render_popup_response(success=False, error='save_failed')

        return self._render_popup_response(success=True)

    def _render_popup_response(self, success: bool, error: str = ''):
        """Возвращает HTML страницу, которая отправляет postMessage и закрывает popup."""
        html = f'''
<!DOCTYPE html>
<html>
<head>
    <title>Google Fit</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: {'#e8f5e9' if success else '#ffebee'};
        }}
        .message {{
            text-align: center;
            padding: 2rem;
        }}
        .icon {{
            font-size: 4rem;
            margin-bottom: 1rem;
        }}
        p {{
            color: {'#2e7d32' if success else '#c62828'};
            font-size: 1.1rem;
        }}
    </style>
</head>
<body>
    <div class="message">
        <div class="icon">{'✓' if success else '✗'}</div>
        <p>{'Успешно подключено! Окно закроется автоматически.' if success else f'Ошибка: {error}'}</p>
    </div>
    <script>
        if (window.opener) {{
            window.opener.postMessage({{
                type: 'google_fit_auth',
                success: {'true' if success else 'false'},
                error: '{error}'
            }}, '*');
            setTimeout(function() {{ window.close(); }}, {'1500' if success else '3000'});
        }}
    </script>
</body>
</html>
'''
        return HttpResponse(html, content_type='text/html')


class GoogleFitStatusView(APIView):
    """Возвращает статус подключения Google Fit."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            connection = client.google_fit_connection
            return Response({
                'connected': connection.is_active,
                'last_sync_at': connection.last_sync_at,
                'scopes': connection.scopes,
                'has_error': bool(connection.last_error),
                'error_message': connection.last_error if connection.error_count > 0 else None,
            })
        except GoogleFitConnection.DoesNotExist:
            return Response({
                'connected': False,
                'last_sync_at': None,
                'scopes': [],
                'has_error': False,
            })


class GoogleFitDisconnectView(APIView):
    """Отключает Google Fit."""

    def post(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            connection = client.google_fit_connection
            connection.delete()
            logger.info('Google Fit disconnected for client %s', client.pk)
            return Response({'status': 'disconnected'})
        except GoogleFitConnection.DoesNotExist:
            return Response({'status': 'not_connected'})


class GoogleFitManualSyncView(APIView):
    """Запускает ручную синхронизацию."""

    def post(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            connection = client.google_fit_connection
            if not connection.is_active:
                return Response(
                    {'error': 'Connection is not active'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            sync_google_fit_for_client.delay(client.pk)
            return Response({'status': 'sync_started'})
        except GoogleFitConnection.DoesNotExist:
            return Response(
                {'error': 'Not connected'},
                status=status.HTTP_400_BAD_REQUEST
            )
