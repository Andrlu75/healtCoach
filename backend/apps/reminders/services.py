import logging
from datetime import datetime, timedelta

import httpx
import pytz
from asgiref.sync import async_to_sync
from django.conf import settings
from django.utils import timezone

from apps.bot.services import (
    _build_client_context,
    _build_metrics_context,
    _build_program_context,
    _build_workouts_context,
)
from apps.persona.models import AIProviderConfig, BotPersona, TelegramBot
from core.ai.factory import get_ai_provider
from core.ai.model_fetcher import log_ai_usage_sync

from .models import Reminder

logger = logging.getLogger(__name__)

TELEGRAM_API = 'https://api.telegram.org'

WEEKDAY_NAMES_RU = {
    0: 'понедельник', 1: 'вторник', 2: 'среда', 3: 'четверг',
    4: 'пятница', 5: 'суббота', 6: 'воскресенье',
}


# --------------- Отправка ---------------

def send_reminder_message(reminder: Reminder) -> bool:
    """Send reminder message to client via Telegram (sync)."""
    client = reminder.client
    coach = reminder.coach

    bot = TelegramBot.objects.filter(coach=coach, is_active=True).first()
    if not bot:
        logger.warning('No active bot for coach %s, skipping reminder %s', coach.pk, reminder.pk)
        return False

    # Определяем текст
    if reminder.reminder_type == 'morning':
        text = generate_morning_greeting(reminder)
    elif reminder.reminder_type == 'meal_program':
        text = _build_meal_program_text(reminder)
    elif reminder.is_smart:
        text = generate_smart_text(reminder)
    else:
        text = reminder.message or reminder.title

    if not text:
        logger.warning('Empty text for reminder %s', reminder.pk)
        return False

    # Отправка
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


# --------------- Напоминание о приёме пищи по программе ---------------

MEAL_TYPE_LABELS = {
    'breakfast': 'завтрак', 'snack1': 'перекус', 'lunch': 'обед',
    'snack2': 'перекус', 'dinner': 'ужин',
}


def _build_meal_program_text(reminder: Reminder) -> str:
    """Строит текст напоминания о ближайшем приёме пищи из программы."""
    from apps.nutrition_programs.services import get_active_program_for_client, get_program_day

    client = reminder.client

    try:
        client_tz = pytz.timezone(client.timezone or 'Europe/Moscow')
    except pytz.exceptions.UnknownTimeZoneError:
        client_tz = pytz.timezone('Europe/Moscow')

    now = timezone.now().astimezone(client_tz)
    today = now.date()

    program = get_active_program_for_client(client)
    if not program:
        return reminder.message or f'{client.first_name}, не забудь поесть!'

    program_day = get_program_day(program, today)
    if not program_day:
        return reminder.message or f'{client.first_name}, не забудь поесть!'

    meals = program_day.meals or []
    offset = timedelta(minutes=reminder.offset_minutes)

    # Ищем ближайший приём пищи (тот, для которого сработало напоминание)
    next_meal = None
    next_meal_dt = None
    for meal in meals:
        meal_time_str = meal.get('time')
        if not meal_time_str:
            continue
        try:
            hour, minute = map(int, meal_time_str.split(':'))
            meal_dt = datetime.combine(today, datetime.min.time().replace(hour=hour, minute=minute))
            meal_dt = client_tz.localize(meal_dt)
            fire_dt = meal_dt - offset
            # Берём приём, до которого напоминание ещё актуально (±5 мин)
            if fire_dt <= now <= meal_dt + timedelta(minutes=5):
                if next_meal_dt is None or meal_dt < next_meal_dt:
                    next_meal = meal
                    next_meal_dt = meal_dt
        except (ValueError, AttributeError):
            continue

    if not next_meal:
        # Fallback — просто берём ближайший будущий приём
        for meal in meals:
            meal_time_str = meal.get('time')
            if not meal_time_str:
                continue
            try:
                hour, minute = map(int, meal_time_str.split(':'))
                meal_dt = datetime.combine(today, datetime.min.time().replace(hour=hour, minute=minute))
                meal_dt = client_tz.localize(meal_dt)
                if meal_dt > now:
                    if next_meal_dt is None or meal_dt < next_meal_dt:
                        next_meal = meal
                        next_meal_dt = meal_dt
            except (ValueError, AttributeError):
                continue

    if not next_meal:
        return reminder.message or f'{client.first_name}, не забудь поесть!'

    meal_label = MEAL_TYPE_LABELS.get(next_meal.get('type', ''), next_meal.get('type', ''))
    meal_name = next_meal.get('name', '')
    meal_time = next_meal.get('time', '')
    meal_desc = next_meal.get('description', '')

    parts = [f'{client.first_name}, скоро {meal_label}']
    if meal_time:
        parts[0] += f' ({meal_time})'
    parts[0] += '!'
    if meal_name:
        parts.append(f'По плану: {meal_name}')
    if meal_desc:
        parts.append(meal_desc)
    parts.append('Не забудь отправить фото отчёт!')

    return '\n'.join(parts)


# --------------- Утреннее приветствие ---------------

def _collect_block_data(block_id: str, client, today, client_tz) -> str | None:
    """Собирает данные для контекстного блока."""
    if block_id == 'greeting':
        weekday = WEEKDAY_NAMES_RU.get(today.weekday(), '')
        return f'Имя клиента: {client.first_name}. Сегодня {weekday}.'

    if block_id == 'weather':
        return _fetch_weather(client.city)

    if block_id == 'meal_plan':
        return async_to_sync(_build_program_context)(client, today)

    if block_id == 'workout_plan':
        return async_to_sync(_build_workouts_context)(client, today)

    if block_id == 'metrics_summary':
        return async_to_sync(_build_metrics_context)(client, today)

    # Блоки, которые AI генерирует сам (sport_tip, nutrition_tip, motivation)
    return None


def _fetch_weather(city: str) -> str | None:
    """Получает прогноз погоды через OpenWeatherMap."""
    api_key = getattr(settings, 'OPENWEATHER_API_KEY', '')
    if not api_key or not city:
        return None

    try:
        resp = httpx.get(
            'https://api.openweathermap.org/data/2.5/weather',
            params={'q': city, 'appid': api_key, 'units': 'metric', 'lang': 'ru'},
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        desc = data.get('weather', [{}])[0].get('description', '')
        temp = data.get('main', {}).get('temp', '')
        feels = data.get('main', {}).get('feels_like', '')
        return f'Погода в {city}: {desc}, {temp}°C (ощущается как {feels}°C)'
    except Exception as e:
        logger.warning('Weather API error for %s: %s', city, e)
        return None


def generate_morning_greeting(reminder: Reminder) -> str:
    """Генерирует уникальное утреннее приветствие через AI."""
    client = reminder.client
    coach = reminder.coach

    # Timezone
    try:
        client_tz = pytz.timezone(client.timezone or 'Europe/Moscow')
    except pytz.exceptions.UnknownTimeZoneError:
        client_tz = pytz.timezone('Europe/Moscow')

    today = timezone.now().astimezone(client_tz).date()

    # Собираем данные для блоков
    blocks = reminder.context_blocks or ['greeting', 'meal_plan']
    block_data = {}
    ai_blocks = []

    for block_id in blocks:
        data = _collect_block_data(block_id, client, today, client_tz)
        if data:
            block_data[block_id] = data
        else:
            ai_blocks.append(block_id)

    # Формируем промпт
    block_labels = {
        'greeting': 'Приветствие',
        'weather': 'Погода',
        'meal_plan': 'План питания на сегодня',
        'workout_plan': 'План тренировки на сегодня',
        'sport_tip': 'Полезный совет по спорту/тренировкам',
        'nutrition_tip': 'Полезный совет по питанию',
        'motivation': 'Мотивирующая фраза',
        'metrics_summary': 'Последние показатели здоровья',
    }

    prompt_parts = ['Сгенерируй утреннее приветствие для клиента. Включи следующие блоки:\n']
    for i, block_id in enumerate(blocks, 1):
        label = block_labels.get(block_id, block_id)
        if block_id in block_data:
            prompt_parts.append(f'{i}. {label}:\n{block_data[block_id]}')
        else:
            prompt_parts.append(f'{i}. {label}: (сгенерируй сам)')

    prompt_parts.append(
        '\nСообщение должно быть живым, дружелюбным и каждый раз звучать по-разному. '
        'Не используй шаблонные фразы. Длина: 3-7 предложений.'
    )

    # Добавляем кастомный промпт коуча если есть
    if reminder.generation_prompt:
        prompt_parts.append(f'\nДополнительные указания от коуча: {reminder.generation_prompt}')

    prompt = '\n'.join(prompt_parts)

    return _call_ai(coach, client, prompt)


# --------------- Обычный smart-текст ---------------

def generate_smart_text(reminder: Reminder) -> str:
    """Generate motivating reminder text using AI."""
    client = reminder.client
    coach = reminder.coach

    prompt = (
        f'Сгенерируй короткое (1-2 предложения) мотивирующее напоминание для клиента.\n'
        f'Тип: {reminder.get_reminder_type_display()}\n'
        f'Название: {reminder.title}\n'
        f'Имя клиента: {client.first_name}\n'
    )

    if reminder.generation_prompt:
        prompt += f'\nДополнительные указания: {reminder.generation_prompt}\n'

    prompt += 'Будь дружелюбным и позитивным. Каждый раз формулируй по-разному.'

    return _call_ai(coach, client, prompt)


# --------------- AI-генерация для кнопки "Сгенерировать" ---------------

def generate_ai_text(
    coach,
    client,
    reminder_type: str = 'custom',
    context_blocks: list | None = None,
    base_text: str = '',
    generation_prompt: str = '',
) -> str:
    """Генерация текста уведомления через AI (для endpoint)."""
    type_labels = dict(Reminder.TYPE_CHOICES)
    type_label = type_labels.get(reminder_type, reminder_type)

    if base_text:
        prompt = (
            f'Доработай и улучши текст уведомления для клиента ({type_label}):\n\n'
            f'Исходный текст: {base_text}\n\n'
            'Сделай текст более живым, дружелюбным и мотивирующим. '
            'Сохрани смысл, но перефразируй.'
        )
    else:
        prompt = (
            f'Сгенерируй текст уведомления для клиента.\n'
            f'Тип: {type_label}\n'
            f'Имя клиента: {client.first_name}\n'
        )

        if context_blocks:
            prompt += f'Контекстные блоки для включения: {", ".join(context_blocks)}\n'

        prompt += 'Текст должен быть живым, дружелюбным и мотивирующим (2-4 предложения).'

    if generation_prompt:
        prompt += f'\n\nДополнительные указания: {generation_prompt}'

    return _call_ai(coach, client, prompt)


# --------------- Общий вызов AI ---------------

def _call_ai(coach, client, prompt: str) -> str:
    """Общая функция вызова AI с контекстом клиента."""
    persona = client.persona
    if not persona:
        persona = BotPersona.objects.filter(coach=coach).first()
    if not persona:
        return ''

    provider_name = persona.text_provider or 'openai'
    config = AIProviderConfig.objects.filter(
        coach=coach, provider=provider_name, is_active=True
    ).first()
    if not config:
        return ''

    provider = get_ai_provider(provider_name, config.api_key)

    system_prompt = persona.system_prompt or 'Ты персональный помощник по здоровью.'
    client_context = _build_client_context(client)
    if client_context:
        system_prompt = system_prompt + client_context
        if client.gender:
            system_prompt += '\n\nВАЖНО: Используй формы обращения с учётом пола клиента.'

    try:
        response = async_to_sync(provider.complete)(
            messages=[{'role': 'user', 'content': prompt}],
            system_prompt=system_prompt,
            max_tokens=500,
            temperature=0.9,
        )

        log_ai_usage_sync(coach, provider_name, '', response, task_type='text', client=client)
        return response.content.strip()
    except Exception as e:
        logger.exception('Failed to generate AI text: %s', e)
        return ''


# --------------- Вычисление next_fire_at ---------------

def compute_next_fire(reminder: Reminder) -> datetime | None:
    """Calculate the next fire time for a reminder."""
    if not reminder.is_active:
        return None

    # Event-напоминания не имеют фиксированного расписания
    if reminder.reminder_type == 'event':
        return None

    # Meal program — динамический расчёт
    if reminder.reminder_type == 'meal_program':
        return _compute_meal_program_next_fire(reminder)

    # Для остальных нужен time
    if not reminder.time:
        return None

    try:
        client_tz = pytz.timezone(reminder.client.timezone or 'Europe/Moscow')
    except pytz.exceptions.UnknownTimeZoneError:
        client_tz = pytz.timezone('Europe/Moscow')

    now = timezone.now()
    now_local = now.astimezone(client_tz)
    today_local = now_local.date()

    if reminder.frequency == 'once':
        if reminder.last_sent_at:
            return None
        fire_local = datetime.combine(today_local, reminder.time)
        fire_local = client_tz.localize(fire_local)
        if fire_local <= now:
            return None
        return fire_local

    elif reminder.frequency == 'daily':
        fire_local = datetime.combine(today_local, reminder.time)
        fire_local = client_tz.localize(fire_local)
        if fire_local <= now:
            fire_local += timedelta(days=1)
        return fire_local

    elif reminder.frequency == 'weekly':
        days = reminder.days_of_week or []
        if not days:
            return None

        for offset in range(14):
            candidate_date = today_local + timedelta(days=offset)
            weekday = candidate_date.isoweekday()
            if weekday in days:
                fire_local = datetime.combine(candidate_date, reminder.time)
                fire_local = client_tz.localize(fire_local)
                if fire_local > now:
                    return fire_local

    elif reminder.frequency == 'custom':
        fire_local = datetime.combine(today_local, reminder.time)
        fire_local = client_tz.localize(fire_local)
        if fire_local <= now:
            fire_local += timedelta(days=1)
        return fire_local

    return None


def _compute_meal_program_next_fire(reminder: Reminder) -> datetime | None:
    """Вычисляет next_fire_at для напоминания о приёме пищи по программе."""
    from apps.nutrition_programs.services import get_active_program_for_client, get_program_day

    client = reminder.client

    try:
        client_tz = pytz.timezone(client.timezone or 'Europe/Moscow')
    except pytz.exceptions.UnknownTimeZoneError:
        client_tz = pytz.timezone('Europe/Moscow')

    now = timezone.now()
    now_local = now.astimezone(client_tz)
    today = now_local.date()

    program = get_active_program_for_client(client)
    if not program:
        return None

    program_day = get_program_day(program, today)
    if not program_day:
        return None

    meals = program_day.meals or []
    offset = timedelta(minutes=reminder.offset_minutes)

    # Ищем ближайший приём пищи, до которого ещё не напомнили
    candidates = []
    for meal in meals:
        meal_time_str = meal.get('time')
        if not meal_time_str:
            continue
        try:
            hour, minute = map(int, meal_time_str.split(':'))
            meal_dt = datetime.combine(today, datetime.min.time().replace(hour=hour, minute=minute))
            meal_dt = client_tz.localize(meal_dt)
            fire_dt = meal_dt - offset
            if fire_dt > now:
                candidates.append(fire_dt)
        except (ValueError, AttributeError):
            continue

    if candidates:
        return min(candidates)
    return None


# --------------- Триггер по событию ---------------

def schedule_event_reminder(client, event_type: str):
    """Планирует отправку event-напоминаний для клиента."""
    reminders = Reminder.objects.filter(
        client=client,
        reminder_type='event',
        trigger_event=event_type,
        is_active=True,
    )

    now = timezone.now()
    for reminder in reminders:
        reminder.next_fire_at = now + timedelta(minutes=reminder.trigger_delay_minutes)
        reminder.save(update_fields=['next_fire_at'])
        logger.info(
            'Scheduled event reminder %s for client %s at %s',
            reminder.pk, client.pk, reminder.next_fire_at,
        )
