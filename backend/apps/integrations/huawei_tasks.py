import logging
from datetime import datetime, timedelta, timezone as dt_timezone

import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.accounts.models import Client
from apps.metrics.models import HealthMetric
from .models import HuaweiHealthConnection, HuaweiHealthSyncLog

logger = logging.getLogger(__name__)

# Huawei Health Kit API
HUAWEI_API_BASE = 'https://health-api.cloud.huawei.com/healthkit/v1'
HUAWEI_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token'

# Типы данных Huawei
DATA_TYPES = {
    'steps': 'com.huawei.continuous.steps.delta',
    'heart_rate': 'com.huawei.instantaneous.heart_rate',
    'calories': 'com.huawei.continuous.calories.burnt',
    'sleep': 'com.huawei.continuous.sleep.fragment',
}


@shared_task(name='integrations.sync_huawei_health_for_client', bind=True, max_retries=3)
def sync_huawei_health_for_client(self, client_id: int, hours_back: int = 24):
    """Синхронизирует данные Huawei Health для конкретного клиента."""
    try:
        client = Client.objects.get(pk=client_id)
        connection = client.huawei_health_connection
    except (Client.DoesNotExist, HuaweiHealthConnection.DoesNotExist):
        logger.warning('No Huawei Health connection for client %s', client_id)
        return

    if not connection.is_active:
        return

    # Создаём лог
    sync_log = HuaweiHealthSyncLog.objects.create(
        connection=connection,
        status='running',
    )

    try:
        # Получаем/обновляем access token
        access_token = _get_valid_access_token(connection)

        # Временной диапазон (в миллисекундах)
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=hours_back)
        start_ms = int(start_time.timestamp() * 1000)
        end_ms = int(end_time.timestamp() * 1000)

        metrics_synced = {}

        # Синхронизируем шаги
        try:
            steps_count = _sync_steps(access_token, client, start_ms, end_ms)
            metrics_synced['steps'] = steps_count
        except Exception as e:
            logger.warning('Error syncing Huawei steps for client %s: %s', client_id, e)
            metrics_synced['steps'] = 0

        # Синхронизируем пульс
        try:
            hr_count = _sync_heart_rate(access_token, client, start_ms, end_ms)
            metrics_synced['heart_rate'] = hr_count
        except Exception as e:
            logger.warning('Error syncing Huawei heart rate for client %s: %s', client_id, e)
            metrics_synced['heart_rate'] = 0

        # Синхронизируем калории
        try:
            cal_count = _sync_calories(access_token, client, start_ms, end_ms)
            metrics_synced['calories'] = cal_count
        except Exception as e:
            logger.warning('Error syncing Huawei calories for client %s: %s', client_id, e)
            metrics_synced['calories'] = 0

        # Синхронизируем сон
        try:
            sleep_count = _sync_sleep(access_token, client, start_ms, end_ms)
            metrics_synced['sleep'] = sleep_count
        except Exception as e:
            logger.warning('Error syncing Huawei sleep for client %s: %s', client_id, e)
            metrics_synced['sleep'] = 0

        # Обновляем статус
        connection.last_sync_at = timezone.now()
        connection.error_count = 0
        connection.last_error = ''
        connection.save(update_fields=['last_sync_at', 'error_count', 'last_error'])

        sync_log.status = 'success'
        sync_log.metrics_synced = metrics_synced
        sync_log.finished_at = timezone.now()
        sync_log.save()

        logger.info('Synced Huawei Health for client %s: %s', client_id, metrics_synced)

    except Exception as e:
        logger.exception('Error syncing Huawei Health for client %s: %s', client_id, e)

        connection.error_count += 1
        connection.last_error = str(e)[:500]

        # Деактивируем после 5 ошибок подряд
        if connection.error_count >= 5:
            connection.is_active = False
            logger.warning('Deactivated Huawei Health connection for client %s after %d errors',
                          client_id, connection.error_count)

        connection.save(update_fields=['error_count', 'last_error', 'is_active'])

        sync_log.status = 'failed'
        sync_log.error_message = str(e)[:1000]
        sync_log.finished_at = timezone.now()
        sync_log.save()


def _get_valid_access_token(connection: HuaweiHealthConnection) -> str:
    """Получает действующий access token, обновляя если нужно."""
    from django.db import transaction

    if not connection.is_token_expired():
        return connection.get_access_token()

    # Блокировка для защиты от race condition при параллельном обновлении токенов
    with transaction.atomic():
        # Перечитываем с блокировкой
        locked_connection = HuaweiHealthConnection.objects.select_for_update().get(pk=connection.pk)

        # Проверяем ещё раз - токен мог быть обновлён другим процессом
        if not locked_connection.is_token_expired():
            return locked_connection.get_access_token()

        # Обновляем токен
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': locked_connection.get_refresh_token(),
            'client_id': settings.HUAWEI_HEALTH_CLIENT_ID,
            'client_secret': settings.HUAWEI_HEALTH_CLIENT_SECRET,
        }

        response = requests.post(HUAWEI_TOKEN_URL, data=data, timeout=30)
        response.raise_for_status()
        token_data = response.json()

        expires_in = token_data.get('expires_in', 3600)
        locked_connection.set_tokens(
            token_data['access_token'],
            token_data.get('refresh_token') or locked_connection.get_refresh_token()
        )
        locked_connection.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
        locked_connection.save(update_fields=[
            'access_token_encrypted',
            'refresh_token_encrypted',
            'token_expires_at'
        ])

        return token_data['access_token']


def _make_api_request(access_token: str, data_type: str, start_ms: int, end_ms: int) -> dict:
    """Выполняет запрос к Huawei Health API."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }

    body = {
        'startTime': start_ms,
        'endTime': end_ms,
        'polymerizeWith': [{
            'dataTypeName': data_type
        }],
        'groupByTime': {
            'duration': 3600000  # группировка по часам
        }
    }

    response = requests.post(
        f'{HUAWEI_API_BASE}/sampleSet:polymerize',
        headers=headers,
        json=body,
        timeout=30
    )
    response.raise_for_status()
    return response.json()


def _sync_steps(access_token: str, client: Client, start_ms: int, end_ms: int) -> int:
    """Синхронизирует шаги."""
    data = _make_api_request(access_token, DATA_TYPES['steps'], start_ms, end_ms)

    count = 0
    for group in data.get('group', []):
        start_time_ms = group.get('startTime', 0)
        recorded_at = datetime.fromtimestamp(start_time_ms / 1000, tz=dt_timezone.utc)

        for sample_set in group.get('sampleSet', []):
            for sample_point in sample_set.get('samplePoints', []):
                value = 0
                for field in sample_point.get('value', []):
                    if field.get('fieldName') == 'steps':
                        value = field.get('intValue', 0)
                        break

                if value > 0:
                    _, created = HealthMetric.objects.update_or_create(
                        client=client,
                        metric_type='steps',
                        recorded_at=recorded_at,
                        source='fitness_tracker',
                        defaults={
                            'value': value,
                            'unit': 'шаги',
                            'notes': 'Huawei Health',
                        }
                    )
                    if created:
                        count += 1

    return count


def _sync_heart_rate(access_token: str, client: Client, start_ms: int, end_ms: int) -> int:
    """Синхронизирует пульс."""
    data = _make_api_request(access_token, DATA_TYPES['heart_rate'], start_ms, end_ms)

    count = 0
    for group in data.get('group', []):
        for sample_set in group.get('sampleSet', []):
            for sample_point in sample_set.get('samplePoints', []):
                start_time_ms = sample_point.get('startTime', 0)
                recorded_at = datetime.fromtimestamp(start_time_ms / 1000, tz=dt_timezone.utc)

                value = 0
                for field in sample_point.get('value', []):
                    if field.get('fieldName') == 'bpm':
                        value = field.get('floatValue', 0)
                        break

                if value > 0:
                    _, created = HealthMetric.objects.update_or_create(
                        client=client,
                        metric_type='heart_rate',
                        recorded_at=recorded_at,
                        source='fitness_tracker',
                        defaults={
                            'value': round(value),
                            'unit': 'уд/мин',
                            'notes': 'Huawei Health',
                        }
                    )
                    if created:
                        count += 1

    return count


def _sync_calories(access_token: str, client: Client, start_ms: int, end_ms: int) -> int:
    """Синхронизирует калории."""
    data = _make_api_request(access_token, DATA_TYPES['calories'], start_ms, end_ms)

    count = 0
    for group in data.get('group', []):
        start_time_ms = group.get('startTime', 0)
        recorded_at = datetime.fromtimestamp(start_time_ms / 1000, tz=dt_timezone.utc)

        for sample_set in group.get('sampleSet', []):
            for sample_point in sample_set.get('samplePoints', []):
                value = 0
                for field in sample_point.get('value', []):
                    if field.get('fieldName') == 'calories':
                        value = field.get('floatValue', 0)
                        break

                if value > 0:
                    _, created = HealthMetric.objects.update_or_create(
                        client=client,
                        metric_type='active_calories',
                        recorded_at=recorded_at,
                        source='fitness_tracker',
                        defaults={
                            'value': round(value),
                            'unit': 'ккал',
                            'notes': 'Huawei Health',
                        }
                    )
                    if created:
                        count += 1

    return count


def _sync_sleep(access_token: str, client: Client, start_ms: int, end_ms: int) -> int:
    """Синхронизирует сон."""
    data = _make_api_request(access_token, DATA_TYPES['sleep'], start_ms, end_ms)

    count = 0
    for group in data.get('group', []):
        for sample_set in group.get('sampleSet', []):
            for sample_point in sample_set.get('samplePoints', []):
                start_time_ms = sample_point.get('startTime', 0)
                end_time_ms = sample_point.get('endTime', 0)

                if start_time_ms and end_time_ms:
                    recorded_at = datetime.fromtimestamp(start_time_ms / 1000, tz=dt_timezone.utc)
                    duration_hours = (end_time_ms - start_time_ms) / 1000 / 3600

                    if duration_hours > 0:
                        _, created = HealthMetric.objects.update_or_create(
                            client=client,
                            metric_type='sleep',
                            recorded_at=recorded_at,
                            source='fitness_tracker',
                            defaults={
                                'value': round(duration_hours, 2),
                                'unit': 'ч',
                                'notes': 'Huawei Health',
                            }
                        )
                        if created:
                            count += 1

    return count


@shared_task(name='integrations.sync_all_huawei_health')
def sync_all_huawei_health():
    """Периодическая задача: синхронизирует всех подключённых клиентов."""
    connections = HuaweiHealthConnection.objects.filter(is_active=True).select_related('client')

    for connection in connections:
        sync_huawei_health_for_client.delay(connection.client_id)

    logger.info('Scheduled Huawei Health sync for %d clients', connections.count())
