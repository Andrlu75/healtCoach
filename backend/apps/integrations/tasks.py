import logging
from datetime import datetime, timedelta, timezone as dt_timezone

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from apps.accounts.models import Client
from apps.metrics.models import HealthMetric
from .models import GoogleFitConnection, GoogleFitSyncLog

logger = logging.getLogger(__name__)

# Data source IDs для Google Fit
DATA_SOURCES = {
    'steps': 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
    'heart_rate': 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm',
    'calories': 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
}


@shared_task(name='integrations.sync_google_fit_for_client', bind=True, max_retries=3)
def sync_google_fit_for_client(self, client_id: int, hours_back: int = 24):
    """Синхронизирует данные Google Fit для конкретного клиента."""
    from django.db import transaction

    try:
        client = Client.objects.get(pk=client_id)
        connection = client.google_fit_connection
    except (Client.DoesNotExist, GoogleFitConnection.DoesNotExist):
        logger.warning('No Google Fit connection for client %s', client_id)
        return

    if not connection.is_active:
        return

    # Создаём лог
    sync_log = GoogleFitSyncLog.objects.create(
        connection=connection,
        status='running',
    )

    try:
        # Получаем/обновляем credentials
        credentials = _get_credentials(connection)

        # Создаём Google Fit API client
        service = build('fitness', 'v1', credentials=credentials)

        # Временной диапазон
        end_time = timezone.now()
        start_time = end_time - timedelta(hours=hours_back)

        metrics_synced = {}

        # Синхронизируем шаги
        try:
            steps_count = _sync_steps(service, client, start_time, end_time)
            metrics_synced['steps'] = steps_count
        except Exception as e:
            logger.warning('Error syncing steps for client %s: %s', client_id, e)
            metrics_synced['steps'] = 0

        # Синхронизируем пульс
        try:
            hr_count = _sync_heart_rate(service, client, start_time, end_time)
            metrics_synced['heart_rate'] = hr_count
        except Exception as e:
            logger.warning('Error syncing heart rate for client %s: %s', client_id, e)
            metrics_synced['heart_rate'] = 0

        # Синхронизируем калории активности
        try:
            cal_count = _sync_calories(service, client, start_time, end_time)
            metrics_synced['calories'] = cal_count
        except Exception as e:
            logger.warning('Error syncing calories for client %s: %s', client_id, e)
            metrics_synced['calories'] = 0

        # Синхронизируем сон
        try:
            sleep_count = _sync_sleep(service, client, start_time, end_time)
            metrics_synced['sleep'] = sleep_count
        except Exception as e:
            logger.warning('Error syncing sleep for client %s: %s', client_id, e)
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

        logger.info('Synced Google Fit for client %s: %s', client_id, metrics_synced)

    except Exception as e:
        logger.exception('Error syncing Google Fit for client %s: %s', client_id, e)

        connection.error_count += 1
        connection.last_error = str(e)[:500]

        # Деактивируем после 5 ошибок подряд
        if connection.error_count >= 5:
            connection.is_active = False
            logger.warning('Deactivated Google Fit connection for client %s after %d errors',
                          client_id, connection.error_count)

        connection.save(update_fields=['error_count', 'last_error', 'is_active'])

        sync_log.status = 'failed'
        sync_log.error_message = str(e)[:1000]
        sync_log.finished_at = timezone.now()
        sync_log.save()


def _get_credentials(connection: GoogleFitConnection) -> Credentials:
    """Получает и обновляет OAuth credentials."""
    from django.db import transaction

    credentials = Credentials(
        token=connection.get_access_token(),
        refresh_token=connection.get_refresh_token(),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=settings.GOOGLE_FIT_CLIENT_ID,
        client_secret=settings.GOOGLE_FIT_CLIENT_SECRET,
        scopes=connection.scopes,
    )

    if connection.is_token_expired():
        # Блокировка для защиты от race condition при параллельном обновлении токенов
        with transaction.atomic():
            # Перечитываем с блокировкой
            locked_connection = GoogleFitConnection.objects.select_for_update().get(pk=connection.pk)

            # Проверяем ещё раз - токен мог быть обновлён другим процессом
            if locked_connection.is_token_expired():
                credentials.refresh(Request())
                locked_connection.set_tokens(
                    credentials.token,
                    credentials.refresh_token or locked_connection.get_refresh_token()
                )
                locked_connection.token_expires_at = credentials.expiry or timezone.now() + timedelta(hours=1)
                locked_connection.save(update_fields=[
                    'access_token_encrypted',
                    'refresh_token_encrypted',
                    'token_expires_at'
                ])
                # Обновляем оригинальный объект
                connection.access_token_encrypted = locked_connection.access_token_encrypted
                connection.refresh_token_encrypted = locked_connection.refresh_token_encrypted
                connection.token_expires_at = locked_connection.token_expires_at
            else:
                # Токен уже обновлён - используем новый
                credentials = Credentials(
                    token=locked_connection.get_access_token(),
                    refresh_token=locked_connection.get_refresh_token(),
                    token_uri='https://oauth2.googleapis.com/token',
                    client_id=settings.GOOGLE_FIT_CLIENT_ID,
                    client_secret=settings.GOOGLE_FIT_CLIENT_SECRET,
                    scopes=locked_connection.scopes,
                )

    return credentials


def _sync_steps(service, client: Client, start_time: datetime, end_time: datetime) -> int:
    """Синхронизирует шаги."""
    start_nanos = int(start_time.timestamp() * 1e9)
    end_nanos = int(end_time.timestamp() * 1e9)

    dataset = service.users().dataSources().datasets().get(
        userId='me',
        dataSourceId=DATA_SOURCES['steps'],
        datasetId=f'{start_nanos}-{end_nanos}',
    ).execute()

    count = 0
    for point in dataset.get('point', []):
        timestamp_nanos = int(point['startTimeNanos'])
        recorded_at = datetime.fromtimestamp(timestamp_nanos / 1e9, tz=dt_timezone.utc)
        value = point['value'][0].get('intVal', 0)

        if value > 0:
            _, created = HealthMetric.objects.update_or_create(
                client=client,
                metric_type='steps',
                recorded_at=recorded_at,
                source='fitness_tracker',
                defaults={
                    'value': value,
                    'unit': 'шаги',
                    'notes': 'Google Fit',
                }
            )
            if created:
                count += 1

    return count


def _sync_heart_rate(service, client: Client, start_time: datetime, end_time: datetime) -> int:
    """Синхронизирует пульс."""
    start_nanos = int(start_time.timestamp() * 1e9)
    end_nanos = int(end_time.timestamp() * 1e9)

    dataset = service.users().dataSources().datasets().get(
        userId='me',
        dataSourceId=DATA_SOURCES['heart_rate'],
        datasetId=f'{start_nanos}-{end_nanos}',
    ).execute()

    count = 0
    for point in dataset.get('point', []):
        timestamp_nanos = int(point['startTimeNanos'])
        recorded_at = datetime.fromtimestamp(timestamp_nanos / 1e9, tz=dt_timezone.utc)
        value = point['value'][0].get('fpVal', 0)

        if value > 0:
            _, created = HealthMetric.objects.update_or_create(
                client=client,
                metric_type='heart_rate',
                recorded_at=recorded_at,
                source='fitness_tracker',
                defaults={
                    'value': round(value),
                    'unit': 'уд/мин',
                    'notes': 'Google Fit',
                }
            )
            if created:
                count += 1

    return count


def _sync_calories(service, client: Client, start_time: datetime, end_time: datetime) -> int:
    """Синхронизирует калории активности."""
    start_nanos = int(start_time.timestamp() * 1e9)
    end_nanos = int(end_time.timestamp() * 1e9)

    dataset = service.users().dataSources().datasets().get(
        userId='me',
        dataSourceId=DATA_SOURCES['calories'],
        datasetId=f'{start_nanos}-{end_nanos}',
    ).execute()

    count = 0
    for point in dataset.get('point', []):
        timestamp_nanos = int(point['startTimeNanos'])
        recorded_at = datetime.fromtimestamp(timestamp_nanos / 1e9, tz=dt_timezone.utc)
        value = point['value'][0].get('fpVal', 0)

        if value > 0:
            _, created = HealthMetric.objects.update_or_create(
                client=client,
                metric_type='active_calories',
                recorded_at=recorded_at,
                source='fitness_tracker',
                defaults={
                    'value': round(value),
                    'unit': 'ккал',
                    'notes': 'Google Fit',
                }
            )
            if created:
                count += 1

    return count


def _sync_sleep(service, client: Client, start_time: datetime, end_time: datetime) -> int:
    """Синхронизирует сон."""
    # Google Fit API требует формат RFC3339 в UTC
    start_utc = start_time.astimezone(dt_timezone.utc).replace(microsecond=0)
    end_utc = end_time.astimezone(dt_timezone.utc).replace(microsecond=0)
    start_str = start_utc.strftime('%Y-%m-%dT%H:%M:%SZ')
    end_str = end_utc.strftime('%Y-%m-%dT%H:%M:%SZ')

    sessions = service.users().sessions().list(
        userId='me',
        startTime=start_str,
        endTime=end_str,
        activityType=72,  # Sleep activity type
    ).execute()

    count = 0
    for session in sessions.get('session', []):
        start_millis = int(session['startTimeMillis'])
        end_millis = int(session['endTimeMillis'])

        recorded_at = datetime.fromtimestamp(start_millis / 1000, tz=dt_timezone.utc)
        duration_hours = (end_millis - start_millis) / 1000 / 3600

        if duration_hours > 0:
            _, created = HealthMetric.objects.update_or_create(
                client=client,
                metric_type='sleep',
                recorded_at=recorded_at,
                source='fitness_tracker',
                defaults={
                    'value': round(duration_hours, 2),
                    'unit': 'ч',
                    'notes': 'Google Fit',
                }
            )
            if created:
                count += 1

    return count


@shared_task(name='integrations.sync_all_google_fit')
def sync_all_google_fit():
    """Периодическая задача: синхронизирует всех подключённых клиентов."""
    connections = GoogleFitConnection.objects.filter(is_active=True).select_related('client')

    for connection in connections:
        sync_google_fit_for_client.delay(connection.client_id)

    logger.info('Scheduled Google Fit sync for %d clients', connections.count())
