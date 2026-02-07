import logging
import time
from decimal import Decimal

from asgiref.sync import sync_to_async

from apps.accounts.models import Client
from apps.chat.models import ChatMessage, InteractionLog
from apps.persona.models import AIProviderConfig, AIUsageLog, BotPersona, TelegramBot
from core.ai.factory import get_ai_provider
from core.ai.tokens import trim_messages_to_token_limit

logger = logging.getLogger(__name__)

# Типичные женские окончания русских имён
FEMALE_NAME_ENDINGS = ('а', 'я', 'ия', 'ья', 'ея')
# Исключения - мужские имена на -а/-я
MALE_NAMES_EXCEPTIONS = {
    'никита', 'илья', 'кузьма', 'фома', 'лука', 'савва', 'данила', 'гаврила',
    'миша', 'саша', 'женя', 'валера', 'дима', 'вова', 'коля', 'петя', 'ваня',
    'серёжа', 'лёша', 'костя', 'гоша', 'паша', 'стёпа', 'толя', 'федя', 'юра',
}


def _detect_gender_from_name(first_name: str) -> str | None:
    """Определить пол по русскому имени. Возвращает 'male'/'female' или None."""
    if not first_name:
        return None

    name_lower = first_name.lower().strip()

    # Проверяем исключения (мужские имена на -а/-я)
    if name_lower in MALE_NAMES_EXCEPTIONS:
        return 'male'

    # Проверяем женские окончания
    for ending in FEMALE_NAME_ENDINGS:
        if name_lower.endswith(ending):
            return 'female'

    # По умолчанию считаем мужским (имена на согласную)
    return 'male'


def _build_client_context(client: Client) -> str:
    """Build client context string with personal info including gender."""
    parts = []

    # Gender - сначала из поля, потом автоопределение по имени
    gender = client.gender
    if not gender and client.first_name:
        gender = _detect_gender_from_name(client.first_name)
        logger.info('[CONTEXT] Auto-detected gender for %s: %s', client.first_name, gender)

    if gender:
        # Нормализуем значение
        if gender.lower() in ('male', 'м', 'мужской', 'муж'):
            gender_label = 'мужчина'
            gender = 'male'
        else:
            gender_label = 'женщина'
            gender = 'female'
        parts.append(f'Пол клиента: {gender_label}')

    # Name
    name = f'{client.first_name} {client.last_name}'.strip()
    if name:
        parts.append(f'Имя: {name}')

    # Age from birth_date
    if client.birth_date:
        from datetime import date
        today = date.today()
        age = today.year - client.birth_date.year - (
            (today.month, today.day) < (client.birth_date.month, client.birth_date.day)
        )
        parts.append(f'Возраст: {age} лет')

    # Physical data
    if client.height:
        parts.append(f'Рост: {client.height} см')
    if client.weight:
        parts.append(f'Вес: {client.weight} кг')

    # Daily norms
    if client.daily_calories:
        parts.append(f'Норма калорий: {client.daily_calories} ккал')

    if not parts:
        return ''

    result = '\n\n[Данные о клиенте]\n' + '\n'.join(parts)

    # Память клиента
    if client.memory:
        result += '\n\n[Память о клиенте]'
        for item in client.memory:
            result += f'\n- {item}'

    return result


def _build_system_prompt(persona_prompt: str, client: Client) -> str:
    """Build full system prompt with persona instructions and client context."""
    client_context = _build_client_context(client)

    if client_context:
        # Add client context and instruction to consider gender
        gender_instruction = ''
        # Проверяем наличие пола в контексте (включая автоопределённый)
        if 'Пол клиента:' in client_context:
            gender_instruction = (
                '\n\nВАЖНО: При всех ответах учитывай пол клиента. '
                'Используй соответствующие формы обращения и рекомендации, '
                'учитывая физиологические особенности.'
            )
        return persona_prompt + client_context + gender_instruction

    return persona_prompt


# --------------- Дневной контекст клиента ---------------

MEAL_TYPE_LABELS = {
    'breakfast': 'Завтрак', 'snack1': 'Перекус', 'lunch': 'Обед',
    'snack2': 'Перекус', 'dinner': 'Ужин',
}

WORKOUT_STATUS_LABELS = {
    'pending': 'ожидает', 'active': 'в процессе', 'completed': 'выполнено',
    'skipped': 'пропущено',
}

METRIC_TYPE_LABELS = {
    'weight': 'Вес', 'sleep': 'Сон', 'steps': 'Шаги',
    'heart_rate': 'Пульс', 'blood_pressure': 'Давление',
    'water': 'Вода', 'active_calories': 'Активные калории',
}


async def _build_program_context(client: Client, today) -> str:
    """Блок активной программы питания: плановые приёмы, ограничения."""
    from apps.nutrition_programs.services import get_active_program_for_client, get_program_day

    program = await sync_to_async(get_active_program_for_client)(client, today)
    if not program:
        return ''

    program_day = await sync_to_async(get_program_day)(program, today)
    if not program_day:
        return ''

    lines = [f'📋 Программа питания: "{program.name}" (день {program_day.day_number} из {program.duration_days})']

    # Плановые приёмы пищи с полным описанием
    meals = program_day.meals or []
    if meals:
        lines.append('Приёмы пищи по плану:')
        for m in meals:
            label = MEAL_TYPE_LABELS.get(m.get('type', ''), m.get('type', ''))
            time_str = f" ({m['time']})" if m.get('time') else ''
            name = m.get('name', '')
            desc = m.get('description', '')
            if desc:
                lines.append(f'- {label}{time_str}: {name}')
                lines.append(f'  {desc}')
            else:
                lines.append(f'- {label}{time_str}: {name}')

    # Запрещённые продукты
    forbidden = program_day.forbidden_ingredients or []
    forbidden_names = [i['name'] if isinstance(i, dict) else str(i) for i in forbidden][:10]
    if forbidden_names:
        lines.append(f'Запрещённые продукты: {", ".join(forbidden_names)}')

    # Разрешённые продукты
    allowed = program_day.allowed_ingredients or []
    allowed_names = [i['name'] if isinstance(i, dict) else str(i) for i in allowed][:10]
    if allowed_names:
        lines.append(f'Рекомендуемые продукты: {", ".join(allowed_names)}')

    # Активность на день
    if program_day.activity:
        lines.append(f'Активность: {program_day.activity}')

    # Общие заметки программы
    if program.general_notes:
        lines.append(f'Заметки: {program.general_notes}')

    return '\n'.join(lines)


async def _build_meals_context(client: Client, today, client_tz) -> str:
    """Блок сегодняшних приёмов пищи с итогами и остатком."""
    from datetime import datetime, time as dt_time
    from apps.meals.models import Meal

    day_start = datetime.combine(today, dt_time.min).replace(tzinfo=client_tz)
    day_end = datetime.combine(today, dt_time.max).replace(tzinfo=client_tz)

    meals = await sync_to_async(
        lambda: list(
            Meal.objects.filter(
                client=client,
                image_type='food',
                meal_time__range=(day_start, day_end),
            ).order_by('meal_time')
        )
    )()

    if not meals:
        return ''

    total_cal = sum(m.calories or 0 for m in meals)
    total_p = sum(m.proteins or 0 for m in meals)
    total_f = sum(m.fats or 0 for m in meals)
    total_c = sum(m.carbohydrates or 0 for m in meals)
    norm_cal = client.daily_calories or 2000

    lines = [f'🍽 Питание сегодня ({len(meals)} приёмов, {int(total_cal)} из {norm_cal} ккал):']
    for m in meals[:10]:
        t = m.meal_time.astimezone(client_tz).strftime('%H:%M') if m.meal_time else ''
        name = (m.dish_name or '')[:50]
        lines.append(
            f'- {t} {name} — {int(m.calories or 0)} ккал '
            f'(Б:{int(m.proteins or 0)} Ж:{int(m.fats or 0)} У:{int(m.carbohydrates or 0)})'
        )

    rem_cal = int(norm_cal - total_cal)
    rem_p = int((client.daily_proteins or 80) - total_p)
    rem_f = int((client.daily_fats or 70) - total_f)
    rem_c = int((client.daily_carbs or 250) - total_c)
    lines.append(f'Остаток: {rem_cal} ккал | Б:{rem_p}г Ж:{rem_f}г У:{rem_c}г')

    return '\n'.join(lines)


async def _build_workouts_context(client: Client, today) -> str:
    """Блок тренировок на сегодня: назначения и сессии."""
    from datetime import datetime, time as dt_time
    import zoneinfo
    from apps.workouts.models.fitdb import FitDBWorkoutAssignment, FitDBWorkoutSession

    assignments = await sync_to_async(
        lambda: list(
            FitDBWorkoutAssignment.objects.filter(
                client=client, due_date=today,
            ).select_related('workout')
        )
    )()

    try:
        client_tz = zoneinfo.ZoneInfo(client.timezone or 'Europe/Moscow')
    except Exception:
        client_tz = zoneinfo.ZoneInfo('Europe/Moscow')

    day_start = datetime.combine(today, dt_time.min).replace(tzinfo=client_tz)
    day_end = datetime.combine(today, dt_time.max).replace(tzinfo=client_tz)

    sessions = await sync_to_async(
        lambda: list(
            FitDBWorkoutSession.objects.filter(
                client=client, started_at__range=(day_start, day_end),
            ).select_related('workout')
        )
    )()

    if not assignments and not sessions:
        return ''

    # Индекс сессий по workout_id для сопоставления с назначениями
    sessions_by_workout = {}
    for s in sessions:
        # Берём последнюю (самую свежую) сессию для каждого workout
        if s.workout_id not in sessions_by_workout or (s.started_at and s.started_at > sessions_by_workout[s.workout_id].started_at):
            sessions_by_workout[s.workout_id] = s

    lines = ['💪 Тренировки сегодня:']
    shown_workout_ids = set()

    for a in assignments:
        shown_workout_ids.add(a.workout_id)
        session = sessions_by_workout.get(a.workout_id)
        if session and session.completed_at:
            duration = f' ({session.duration_seconds // 60} мин)' if session.duration_seconds else ''
            lines.append(f'- {a.workout.name} — выполнено{duration}')
        elif session:
            lines.append(f'- {a.workout.name} — в процессе')
        else:
            status = WORKOUT_STATUS_LABELS.get(a.status, a.status)
            lines.append(f'- {a.workout.name} — {status}')

    # Сессии без назначений
    for s in sessions:
        if s.workout_id not in shown_workout_ids:
            shown_workout_ids.add(s.workout_id)
            duration = f' ({s.duration_seconds // 60} мин)' if s.duration_seconds else ''
            status = 'выполнено' if s.completed_at else 'в процессе'
            lines.append(f'- {s.workout.name} — {status}{duration}')

    return '\n'.join(lines)


async def _build_metrics_context(client: Client, today) -> str:
    """Блок последних показателей здоровья (1 на тип, за 2 дня)."""
    from datetime import timedelta
    from apps.metrics.models import HealthMetric

    week_ago = today - timedelta(days=2)

    metrics = await sync_to_async(
        lambda: list(
            HealthMetric.objects.filter(
                client=client, recorded_at__date__gte=week_ago,
            ).order_by('metric_type', '-recorded_at')
        )
    )()

    if not metrics:
        return ''

    # Оставляем по 1 последнему значению на тип
    seen = set()
    latest = []
    for m in metrics:
        if m.metric_type not in seen:
            seen.add(m.metric_type)
            latest.append(m)

    if not latest:
        return ''

    lines = ['📊 Последние показатели:']
    for m in latest[:6]:
        name = METRIC_TYPE_LABELS.get(m.metric_type, m.metric_type)
        days_ago = (today - m.recorded_at.date()).days
        ago = 'сегодня' if days_ago == 0 else f'{days_ago} дн. назад'
        val = m.value
        if isinstance(val, float):
            val = f'{val:.1f}'.rstrip('0').rstrip('.')
        lines.append(f'- {name}: {val} {m.unit or ""} ({ago})')

    return '\n'.join(lines)


async def build_client_daily_context(client: Client) -> str:
    """Собрать полный дневной контекст клиента для AI.

    Включает: программу питания, сегодняшние приёмы, тренировки, метрики.
    Целевой размер: ~800-1000 токенов.
    """
    import zoneinfo

    try:
        client_tz = zoneinfo.ZoneInfo(client.timezone or 'Europe/Moscow')
    except Exception:
        client_tz = zoneinfo.ZoneInfo('Europe/Moscow')

    from datetime import datetime
    today = datetime.now(client_tz).date()

    parts = []

    program = await _build_program_context(client, today)
    if program:
        parts.append(program)

    meals = await _build_meals_context(client, today, client_tz)
    if meals:
        parts.append(meals)

    workouts = await _build_workouts_context(client, today)
    if workouts:
        parts.append(workouts)

    metrics = await _build_metrics_context(client, today)
    if metrics:
        parts.append(metrics)

    if not parts:
        return ''

    context = '\n\n[Дневной контекст]\n\n' + '\n\n'.join(parts)

    # Если есть и программа питания, и фактические приёмы — добавить инструкцию сравнивать
    if program and meals:
        context += (
            '\n\n[Инструкция по анализу питания]\n'
            'Сравнивай фактические приёмы пищи клиента с планом программы питания.\n'
            '- Если блюдо отличается от плана — мягко отметь разницу и подскажи, '
            'как можно скорректировать в следующий раз.\n'
            '- Не требуй идеального совпадения — небольшие отклонения это нормально, '
            'главное общее направление.\n'
            '- Отмечай положительные моменты, даже если есть отклонения.\n'
            '- Если отклонение существенное (совсем другое блюдо или сильно другие КБЖУ) — '
            'обрати на это внимание, но дружелюбно, без критики.\n'
            '- Будь конкретным: упоминай конкретные блюда и цифры, избегай общих фраз.'
        )

    return context


async def _build_full_system_prompt(persona_prompt: str, client: Client) -> str:
    """Полный системный промпт: персона + данные клиента + дневной контекст."""
    base = _build_system_prompt(persona_prompt, client)
    daily = await build_client_daily_context(client)
    full = base + '\n' + daily if daily else base

    # Инструкция по запоминанию
    full += (
        '\n\n[Инструкция по запоминанию]\n'
        'Если клиент просит тебя что-то запомнить (например "запомни что...", "имей в виду...", '
        '"учти что...", "называй меня..."), '
        'сформулируй кратко что нужно запомнить и спроси подтверждение. '
        'Ответ ОБЯЗАТЕЛЬНО заверши тегом на отдельной строке:\n'
        '[MEMORY_SAVE: краткая формулировка факта]\n'
        'Если клиент просит забыть что-то ранее запомненное — '
        'ответь подтверждением и заверши тегом:\n'
        '[MEMORY_DELETE: точный текст записи для удаления]'
    )

    return full


async def _get_persona(bot: TelegramBot, client: Client | None = None) -> BotPersona:
    def _resolve():
        # Priority: client.persona → coach default → first coach persona
        if client and client.persona_id:
            return client.persona
        default = BotPersona.objects.filter(coach=bot.coach, is_default=True).first()
        if default:
            return default
        return BotPersona.objects.filter(coach=bot.coach).first()
    persona = await sync_to_async(_resolve)()
    if not persona:
        raise BotPersona.DoesNotExist('No persona configured for coach')
    return persona


async def _get_api_key(coach, provider_name: str) -> str:
    config = await sync_to_async(
        lambda: AIProviderConfig.objects.filter(
            coach=coach, provider=provider_name, is_active=True
        ).first()
    )()
    if not config:
        raise ValueError(f'No API key configured for provider: {provider_name}')
    return config.api_key


async def _save_message(client: Client, role: str, content: str, message_type: str = 'text', **kwargs) -> ChatMessage:
    return await sync_to_async(ChatMessage.objects.create)(
        client=client,
        role=role,
        content=content,
        message_type=message_type,
        **kwargs,
    )


async def _get_context_messages(
    client: Client,
    limit: int = 50,
    model: str = 'gpt-4o',
    max_tokens: int | None = None,
) -> list[dict]:
    """Получить контекст сообщений для клиента с учётом лимита токенов.

    Args:
        client: Клиент
        limit: Максимальное количество сообщений для загрузки
        model: Модель AI (для подсчёта токенов)
        max_tokens: Максимум токенов (по умолчанию — лимит модели)

    Returns:
        Список сообщений, обрезанный по токенам
    """
    messages = await sync_to_async(
        lambda: list(
            ChatMessage.objects.filter(client=client)
            .order_by('-created_at')[:limit]
        )
    )()
    messages.reverse()
    message_dicts = [{'role': msg.role, 'content': msg.content} for msg in messages]

    # Обрезаем по токенам
    return trim_messages_to_token_limit(message_dicts, max_tokens=max_tokens, model=model)


async def _log_usage(coach, client, provider_name: str, model: str, task_type: str, usage: dict):
    from core.ai.model_fetcher import get_cached_pricing

    # Extract tokens with fallback for OpenAI format
    input_tokens = usage.get('input_tokens') or usage.get('prompt_tokens') or 0
    output_tokens = usage.get('output_tokens') or usage.get('completion_tokens') or 0

    # Calculate cost from OpenRouter pricing
    cost_usd = Decimal('0')
    if input_tokens or output_tokens:
        pricing = get_cached_pricing(provider_name, model)
        if pricing:
            price_in, price_out = pricing
            cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))
        else:
            logger.warning(
                '[AI USAGE] No pricing found for provider=%s model=%s, tokens_in=%s tokens_out=%s -> cost=$0',
                provider_name, model, input_tokens, output_tokens
            )

    await sync_to_async(AIUsageLog.objects.create)(
        coach=coach,
        client=client,
        provider=provider_name,
        model=model,
        task_type=task_type,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )


async def get_ai_text_response(bot: TelegramBot, client: Client, text: str) -> str:
    """Main text conversation flow."""
    persona = await _get_persona(bot, client)

    # Save user message
    await _save_message(client, 'user', text, 'text')

    # Get AI provider config
    provider_name = persona.text_provider or 'openai'
    model = persona.text_model or 'gpt-4o-mini'

    # Load context with token limit
    context = await _get_context_messages(client, model=model)

    # Build system prompt with client context + daily context
    system_prompt = await _build_full_system_prompt(persona.system_prompt, client)
    api_key = await _get_api_key(bot.coach, provider_name)
    provider = get_ai_provider(provider_name, api_key)

    # Call AI
    start_time = time.time()
    response = await provider.complete(
        messages=context,
        system_prompt=system_prompt,
        max_tokens=persona.max_tokens,
        temperature=persona.temperature,
        model=model,
    )
    duration_ms = int((time.time() - start_time) * 1000)

    # Save assistant response
    await _save_message(
        client, 'assistant', response.content, 'text',
        ai_response_id=response.response_id or '',
        ai_provider=provider_name,
    )

    # Log usage
    await _log_usage(
        bot.coach, client, provider_name,
        response.model or model or '', 'text', response.usage,
    )

    # Log interaction
    await sync_to_async(InteractionLog.objects.create)(
        client=client,
        coach=bot.coach,
        interaction_type='text',
        client_input=text,
        ai_request={
            'system_prompt': system_prompt,
            'messages': context,
            'provider': provider_name,
            'model': model or '',
            'temperature': persona.temperature,
            'max_tokens': persona.max_tokens,
        },
        ai_response={
            'content': response.content,
            'model': response.model or '',
            'usage': response.usage or {},
            'response_id': response.response_id or '',
        },
        client_output=response.content,
        provider=provider_name,
        model=response.model or model or '',
        duration_ms=duration_ms,
    )

    return response.content


async def get_ai_vision_response(bot: TelegramBot, client: Client, image_data: bytes, caption: str = '') -> str:
    """Photo analysis flow."""
    persona = await _get_persona(bot, client)

    # Save user message
    user_text = caption or '[Фото]'
    await _save_message(client, 'user', user_text, 'photo')

    # Get vision provider
    provider_name = persona.vision_provider or persona.text_provider or 'openai'
    model = persona.vision_model or persona.text_model or None
    api_key = await _get_api_key(bot.coach, provider_name)
    provider = get_ai_provider(provider_name, api_key)

    # Build prompt with client context (including gender)
    system_prompt = _build_system_prompt(persona.system_prompt, client)
    prompt = system_prompt + '\n\n'
    if caption:
        prompt += f'Пользователь отправил фото с подписью: "{caption}". Проанализируй изображение.'
    else:
        prompt += 'Пользователь отправил фото. Проанализируй изображение и дай рекомендации.'

    # Call AI vision
    start_time = time.time()
    response = await provider.analyze_image(
        image_data=image_data,
        prompt=prompt,
        max_tokens=persona.max_tokens,
        model=model,
    )
    duration_ms = int((time.time() - start_time) * 1000)

    # Save assistant response
    await _save_message(
        client, 'assistant', response.content, 'text',
        ai_response_id=response.response_id or '',
        ai_provider=provider_name,
    )

    # Log usage
    await _log_usage(
        bot.coach, client, provider_name,
        response.model or model or '', 'vision', response.usage,
    )

    # Log interaction
    await sync_to_async(InteractionLog.objects.create)(
        client=client,
        coach=bot.coach,
        interaction_type='vision',
        client_input=user_text,
        ai_request={
            'system_prompt': persona.system_prompt,
            'prompt': prompt,
            'provider': provider_name,
            'model': model or '',
            'max_tokens': persona.max_tokens,
        },
        ai_response={
            'content': response.content,
            'model': response.model or '',
            'usage': response.usage or {},
            'response_id': response.response_id or '',
        },
        client_output=response.content,
        provider=provider_name,
        model=response.model or model or '',
        duration_ms=duration_ms,
    )

    return response.content


async def transcribe_audio(bot: TelegramBot, audio_data: bytes) -> str:
    """Transcribe audio to text. Uses voice_provider or falls back to openai."""
    persona = await _get_persona(bot)

    # Determine transcription provider - fallback to openai for providers that can't transcribe
    provider_name = persona.voice_provider or 'openai'
    if provider_name in ('anthropic', 'deepseek'):
        provider_name = 'openai'

    api_key = await _get_api_key(bot.coach, provider_name)
    provider = get_ai_provider(provider_name, api_key)

    text = await provider.transcribe_audio(audio_data, language='ru')

    # Log usage
    await _log_usage(
        bot.coach, None, provider_name,
        'whisper-1' if provider_name == 'openai' else '', 'voice', {},
    )

    return text
