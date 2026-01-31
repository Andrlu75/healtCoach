import hashlib
import hmac
import html
import logging
from datetime import timedelta
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.clickjacking import xframe_options_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.bot.client_views import get_client_from_token
from .models import HuaweiHealthConnection
from .huawei_tasks import sync_huawei_health_for_client

logger = logging.getLogger(__name__)

# Huawei Health Kit Scopes
HUAWEI_HEALTH_SCOPES = [
    'https://www.huawei.com/healthkit/step.read',
    'https://www.huawei.com/healthkit/heartrate.read',
    'https://www.huawei.com/healthkit/sleep.read',
    'https://www.huawei.com/healthkit/calories.read',
]

# Huawei OAuth URLs
HUAWEI_AUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize'
HUAWEI_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token'

# Безопасный origin для postMessage (первый из разрешённых CORS origins)
SAFE_POST_MESSAGE_ORIGIN = getattr(settings, 'CORS_ALLOWED_ORIGINS', ['*'])[0] if hasattr(settings, 'CORS_ALLOWED_ORIGINS') and settings.CORS_ALLOWED_ORIGINS else '*'


def _sign_state(client_id: int) -> str:
    """Создаёт подписанный state для OAuth."""
    payload = str(client_id)
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()[:16]
    return f"{client_id}:{signature}"


def _verify_state(state: str) -> int | None:
    """Проверяет подпись state и возвращает client_id."""
    try:
        parts = state.split(':')
        if len(parts) != 2:
            return None
        client_id = int(parts[0])
        expected_signature = hmac.new(
            settings.SECRET_KEY.encode(),
            str(client_id).encode(),
            hashlib.sha256
        ).hexdigest()[:16]
        if hmac.compare_digest(parts[1], expected_signature):
            return client_id
        return None
    except (ValueError, AttributeError):
        return None


class HuaweiHealthAuthURLView(APIView):
    """Генерирует URL для OAuth авторизации Huawei Health."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        # State содержит подписанный client_id для защиты от подделки
        signed_state = _sign_state(client.pk)
        params = {
            'client_id': settings.HUAWEI_HEALTH_CLIENT_ID,
            'redirect_uri': settings.HUAWEI_HEALTH_REDIRECT_URI,
            'response_type': 'code',
            'scope': ' '.join(HUAWEI_HEALTH_SCOPES),
            'state': signed_state,
            'access_type': 'offline',
        }

        auth_url = f'{HUAWEI_AUTH_URL}?{urlencode(params)}'

        return Response({
            'auth_url': auth_url,
            'state': signed_state,
        })


@method_decorator(xframe_options_exempt, name='dispatch')
class HuaweiHealthCallbackView(APIView):
    """
    Обрабатывает callback от Huawei OAuth.
    Возвращает HTML страницу, которая отправляет postMessage и закрывает popup.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        code = request.query_params.get('code')
        state = request.query_params.get('state')
        error = request.query_params.get('error')

        if error:
            logger.warning('Huawei Health OAuth error: %s', error)
            return self._render_popup_response(success=False, error=error)

        if not code or not state:
            return self._render_popup_response(success=False, error='missing_params')

        # Проверяем подпись state для защиты от подделки
        client_id = _verify_state(state)
        if client_id is None:
            logger.warning('Huawei Health OAuth invalid state signature: %s', state[:20] if state else 'empty')
            return self._render_popup_response(success=False, error='invalid_state')

        # Exchange code for tokens
        try:
            token_data = self._exchange_code_for_tokens(code)
        except Exception as e:
            logger.exception('Huawei Health token exchange error: %s', e)
            return self._render_popup_response(success=False, error='token_exchange_failed')

        # Save connection
        from apps.accounts.models import Client
        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return self._render_popup_response(success=False, error='client_not_found')

        try:
            expires_in = token_data.get('expires_in', 3600)
            token_expires_at = timezone.now() + timedelta(seconds=expires_in)

            connection, created = HuaweiHealthConnection.objects.update_or_create(
                client=client,
                defaults={
                    'is_active': True,
                    'scopes': HUAWEI_HEALTH_SCOPES,
                    'token_expires_at': token_expires_at,
                    'error_count': 0,
                    'last_error': '',
                    'access_token_encrypted': '',
                    'refresh_token_encrypted': '',
                }
            )

            connection.set_tokens(
                token_data['access_token'],
                token_data.get('refresh_token', '')
            )
            connection.save()

            logger.info('Huawei Health connected for client %s', client_id)

            # Trigger initial sync
            try:
                sync_huawei_health_for_client.delay(client.pk)
            except Exception as celery_error:
                logger.warning('Could not queue Huawei sync task: %s', celery_error)

        except Exception as e:
            logger.exception('Error saving Huawei Health connection: %s', e)
            return self._render_popup_response(success=False, error=f'save_failed: {type(e).__name__}')

        return self._render_popup_response(success=True)

    def _exchange_code_for_tokens(self, code: str) -> dict:
        """Обменивает authorization code на токены."""
        data = {
            'grant_type': 'authorization_code',
            'code': code,
            'client_id': settings.HUAWEI_HEALTH_CLIENT_ID,
            'client_secret': settings.HUAWEI_HEALTH_CLIENT_SECRET,
            'redirect_uri': settings.HUAWEI_HEALTH_REDIRECT_URI,
        }

        response = requests.post(HUAWEI_TOKEN_URL, data=data, timeout=30)
        response.raise_for_status()
        return response.json()

    def _render_popup_response(self, success: bool, error: str = ''):
        """Возвращает HTML страницу, которая отправляет postMessage и закрывает popup."""
        # Экранируем error для защиты от XSS
        safe_error = html.escape(error)
        html_content = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Huawei Health</title>
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
        <p>{'Huawei Health подключён! Окно закроется автоматически.' if success else f'Ошибка: {safe_error}'}</p>
    </div>
    <script>
        if (window.opener) {{
            window.opener.postMessage({{
                type: 'huawei_health_auth',
                success: {'true' if success else 'false'},
                error: '{safe_error}'
            }}, '{SAFE_POST_MESSAGE_ORIGIN}');
            setTimeout(function() {{ window.close(); }}, {'1500' if success else '3000'});
        }}
    </script>
</body>
</html>
'''
        response = HttpResponse(html_content, content_type='text/html')
        response['X-Frame-Options'] = 'ALLOWALL'
        response['Cross-Origin-Opener-Policy'] = 'unsafe-none'
        return response


class HuaweiHealthStatusView(APIView):
    """Возвращает статус подключения Huawei Health."""

    def get(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            connection = client.huawei_health_connection
            return Response({
                'connected': connection.is_active,
                'last_sync_at': connection.last_sync_at,
                'scopes': connection.scopes,
                'has_error': bool(connection.last_error),
                'error_message': connection.last_error if connection.error_count > 0 else None,
            })
        except HuaweiHealthConnection.DoesNotExist:
            return Response({
                'connected': False,
                'last_sync_at': None,
                'scopes': [],
                'has_error': False,
            })


class HuaweiHealthDisconnectView(APIView):
    """Отключает Huawei Health."""

    def post(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            connection = client.huawei_health_connection
            connection.delete()
            logger.info('Huawei Health disconnected for client %s', client.pk)
            return Response({'status': 'disconnected'})
        except HuaweiHealthConnection.DoesNotExist:
            return Response({'status': 'not_connected'})


class HuaweiHealthManualSyncView(APIView):
    """Запускает ручную синхронизацию Huawei Health."""

    def post(self, request):
        client = get_client_from_token(request)
        if not client:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            connection = client.huawei_health_connection
            if not connection.is_active:
                return Response(
                    {'error': 'Connection is not active'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            sync_huawei_health_for_client.delay(client.pk)
            return Response({'status': 'sync_started'})
        except HuaweiHealthConnection.DoesNotExist:
            return Response(
                {'error': 'Not connected'},
                status=status.HTTP_400_BAD_REQUEST
            )
