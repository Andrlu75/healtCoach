import logging
from datetime import date, timedelta

import httpx
from celery import shared_task

from apps.accounts.models import Client
from apps.persona.models import TelegramBot

from .models import Report
from .services import generate_report

logger = logging.getLogger(__name__)

TELEGRAM_API = 'https://api.telegram.org'


@shared_task(name='reports.generate_daily_reports', bind=True, max_retries=2)
def generate_daily_reports(self):
    """Generate daily reports for all active clients (yesterday's data)."""
    from django.db import IntegrityError

    yesterday = date.today() - timedelta(days=1)
    clients = Client.objects.filter(status='active').select_related('coach')

    count = 0
    for client in clients:
        try:
            # Skip if report already exists
            if Report.objects.filter(
                client=client, report_type='daily', period_start=yesterday
            ).exists():
                continue

            report = generate_report(client, 'daily', yesterday)
            send_report.delay(report.pk)
            count += 1
        except IntegrityError:
            # Report already created by another worker (race condition)
            logger.info('Report already exists for client %s (race condition)', client.pk)
        except Exception as e:
            logger.exception('Failed to generate daily report for client %s: %s', client.pk, e)

    logger.info('Generated %d daily reports', count)


@shared_task(name='reports.generate_weekly_reports', bind=True, max_retries=2)
def generate_weekly_reports(self):
    """Generate weekly reports for all active clients (last week)."""
    from django.db import IntegrityError

    last_monday = date.today() - timedelta(days=7)
    clients = Client.objects.filter(status='active').select_related('coach')

    count = 0
    for client in clients:
        try:
            if Report.objects.filter(
                client=client, report_type='weekly', period_start=last_monday
            ).exists():
                continue

            report = generate_report(client, 'weekly', last_monday)
            send_report.delay(report.pk)
            count += 1
        except IntegrityError:
            # Report already created by another worker (race condition)
            logger.info('Weekly report already exists for client %s (race condition)', client.pk)
        except Exception as e:
            logger.exception('Failed to generate weekly report for client %s: %s', client.pk, e)

    logger.info('Generated %d weekly reports', count)


@shared_task(name='reports.send_report', bind=True, max_retries=3, default_retry_delay=60)
def send_report(self, report_id: int):
    """Send report PDF to client and coach via Telegram."""
    try:
        report = Report.objects.select_related('client', 'coach').get(pk=report_id)
    except Report.DoesNotExist:
        return

    bot = TelegramBot.objects.filter(coach=report.coach, is_active=True).first()
    if not bot:
        logger.warning('No active bot for coach %s', report.coach.pk)
        return

    # Send to client
    chat_id = report.client.telegram_user_id
    type_label = 'Дневной' if report.report_type == 'daily' else 'Недельный'
    caption = f'{type_label} отчёт: {report.period_start} — {report.period_end}'

    if report.summary:
        caption += f'\n\n{report.summary}'

    # Send PDF if available
    if report.pdf_file:
        _send_document(bot.token, chat_id, report.pdf_file, caption)
    else:
        # Send text summary only
        _send_text(bot.token, chat_id, caption)

    # Also send to coach notification chat
    if report.coach.telegram_notification_chat_id:
        coach_caption = f'{report.client.first_name}: {caption}'
        if report.pdf_file:
            _send_document(
                bot.token,
                int(report.coach.telegram_notification_chat_id),
                report.pdf_file,
                coach_caption,
            )

    report.is_sent = True
    report.save(update_fields=['is_sent'])


def _send_document(token: str, chat_id: int, file_field, caption: str):
    """Send a document via Telegram API."""
    try:
        with file_field.open('rb') as f:
            resp = httpx.post(
                f'{TELEGRAM_API}/bot{token}/sendDocument',
                data={'chat_id': chat_id, 'caption': caption[:1024]},
                files={'document': (file_field.name.split('/')[-1], f, 'application/pdf')},
                timeout=30,
            )
            result = resp.json()
            if not result.get('ok'):
                logger.error('Failed to send document: %s', result)
    except Exception as e:
        logger.exception('Error sending document to %s: %s', chat_id, e)


def _send_text(token: str, chat_id: int, text: str):
    """Send text message via Telegram API."""
    try:
        httpx.post(
            f'{TELEGRAM_API}/bot{token}/sendMessage',
            json={'chat_id': chat_id, 'text': text},
            timeout=10,
        )
    except Exception as e:
        logger.exception('Error sending text to %s: %s', chat_id, e)
