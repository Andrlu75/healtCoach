import logging
from datetime import datetime, time, timedelta

import httpx
import pytz
from asgiref.sync import async_to_sync
from django.utils import timezone

from apps.persona.models import AIProviderConfig, BotPersona, TelegramBot
from core.ai.factory import get_ai_provider

from .models import Reminder

logger = logging.getLogger(__name__)

TELEGRAM_API = 'https://api.telegram.org'


def send_reminder_message(reminder: Reminder) -> bool:
    """Send reminder message to client via Telegram (sync)."""
    client = reminder.client
    coach = reminder.coach

    # Get active bot for this coach
    bot = TelegramBot.objects.filter(coach=coach, is_active=True).first()
    if not bot:
        logger.warning('No active bot for coach %s, skipping reminder %s', coach.pk, reminder.pk)
        return False

    # Determine message text
    if reminder.is_smart:
        text = generate_smart_text(reminder)
    else:
        text = reminder.message or reminder.title

    # Send via Telegram API (sync httpx)
    chat_id = client.telegram_user_id
    try:
        resp = httpx.post(
            f'{TELEGRAM_API}/bot{bot.token}/sendMessage',
            json={'chat_id': chat_id, 'text': text},
            timeout=10,
        )
        result = resp.json()
        if not result.get('ok'):
            logger.error('Failed to send reminder %s: %s', reminder.pk, result)
            return False
        return True
    except httpx.RequestError as e:
        logger.exception('Error sending reminder %s: %s', reminder.pk, e)
        return False


def generate_smart_text(reminder: Reminder) -> str:
    """Generate motivating reminder text using AI."""
    coach = reminder.coach

    persona = BotPersona.objects.filter(coach=coach).first()
    if not persona:
        return reminder.message or reminder.title

    provider_name = persona.text_provider or 'openai'
    config = AIProviderConfig.objects.filter(
        coach=coach, provider=provider_name, is_active=True
    ).first()
    if not config:
        return reminder.message or reminder.title

    provider = get_ai_provider(provider_name, config.api_key)

    prompt = (
        f'Сгенерируй короткое (1-2 предложения) мотивирующее напоминание для клиента.\n'
        f'Тип: {reminder.get_reminder_type_display()}\n'
        f'Название: {reminder.title}\n'
        f'Имя клиента: {reminder.client.first_name}\n'
        f'Будь дружелюбным и позитивным. Не используй emoji.'
    )

    try:
        response = async_to_sync(provider.complete)(
            messages=[{'role': 'user', 'content': prompt}],
            system_prompt=persona.system_prompt or 'Ты персональный помощник по здоровью.',
            max_tokens=100,
            temperature=0.9,
        )
        return response.content.strip()
    except Exception as e:
        logger.exception('Failed to generate smart text for reminder %s: %s', reminder.pk, e)
        return reminder.message or reminder.title


def compute_next_fire(reminder: Reminder) -> datetime | None:
    """Calculate the next fire time for a reminder."""
    if not reminder.is_active:
        return None

    # Get client timezone
    try:
        client_tz = pytz.timezone(reminder.client.timezone)
    except pytz.exceptions.UnknownTimeZoneError:
        client_tz = pytz.timezone('Europe/Moscow')

    now = timezone.now()
    now_local = now.astimezone(client_tz)
    today_local = now_local.date()

    if reminder.frequency == 'once':
        # One-time reminder: if already sent, no next fire
        if reminder.last_sent_at:
            return None
        # Schedule for today at the specified time, or tomorrow if past
        fire_local = datetime.combine(today_local, reminder.time)
        fire_local = client_tz.localize(fire_local)
        if fire_local <= now:
            return None  # Already past, one-time
        return fire_local

    elif reminder.frequency == 'daily':
        # Next occurrence: today or tomorrow at reminder.time
        fire_local = datetime.combine(today_local, reminder.time)
        fire_local = client_tz.localize(fire_local)
        if fire_local <= now:
            fire_local += timedelta(days=1)
        return fire_local

    elif reminder.frequency == 'weekly':
        # Find next matching day of week
        days = reminder.days_of_week or []
        if not days:
            return None

        for offset in range(7):
            candidate_date = today_local + timedelta(days=offset)
            weekday = candidate_date.isoweekday()  # 1=Mon, 7=Sun
            if weekday in days:
                fire_local = datetime.combine(candidate_date, reminder.time)
                fire_local = client_tz.localize(fire_local)
                if fire_local > now:
                    return fire_local
        # Wrap around to next week
        for offset in range(7, 14):
            candidate_date = today_local + timedelta(days=offset)
            weekday = candidate_date.isoweekday()
            if weekday in days:
                fire_local = datetime.combine(candidate_date, reminder.time)
                fire_local = client_tz.localize(fire_local)
                return fire_local

    elif reminder.frequency == 'custom':
        # Custom: same as daily for now
        fire_local = datetime.combine(today_local, reminder.time)
        fire_local = client_tz.localize(fire_local)
        if fire_local <= now:
            fire_local += timedelta(days=1)
        return fire_local

    return None
