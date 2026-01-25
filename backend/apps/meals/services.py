import json
import logging
from datetime import date, datetime, time
from io import BytesIO

from asgiref.sync import sync_to_async
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.accounts.models import Client
from apps.persona.models import AIProviderConfig, AIUsageLog, BotPersona, TelegramBot
from core.ai.factory import get_ai_provider

from .models import Meal

logger = logging.getLogger(__name__)

MEAL_CORRECTION_WINDOW_MINUTES = 5

CLASSIFY_CORRECTION_PROMPT = """Пользователь ранее отправил фото еды, которое было распознано как: "{dish_name}" ({calories} ккал, Б:{proteins} Ж:{fats} У:{carbs}).

Теперь пользователь написал: "{user_text}"

Это уточнение/коррекция к предыдущему блюду (название, порция, вес, ингредиенты)? Ответь ОДНИМ словом: YES или NO."""

RECALCULATE_PROMPT = """Пользователь уточнил информацию о блюде.

Предыдущее распознавание:
- Блюдо: {dish_name}
- Калории: {calories}, Белки: {proteins}, Жиры: {fats}, Углеводы: {carbs}

Уточнение пользователя: "{user_text}"

Пересчитай КБЖУ с учётом уточнения. Верни JSON (без markdown-обёртки, только чистый JSON):
{{
  "dish_name": "уточнённое название",
  "dish_type": "тип (завтрак/обед/ужин/перекус)",
  "calories": число_ккал,
  "proteins": граммы_белка,
  "fats": граммы_жиров,
  "carbohydrates": граммы_углеводов
}}
"""

RECALCULATE_MINIAPP_PROMPT = """Пользователь уточнил информацию о блюде.

Предыдущее распознавание:
- Блюдо: {dish_name}
- Тип: {dish_type}
- Калории: {calories}, Белки: {proteins}, Жиры: {fats}, Углеводы: {carbs}
- Ингредиенты: {ingredients}

Уточнение пользователя: "{correction}"

Пересчитай КБЖУ и обнови список ингредиентов с учётом уточнения. Верни JSON (без markdown-обёртки, только чистый JSON):
{{
  "dish_name": "уточнённое название блюда",
  "dish_type": "тип (завтрак/обед/ужин/перекус)",
  "calories": число_ккал,
  "proteins": граммы_белка,
  "fats": граммы_жиров,
  "carbohydrates": граммы_углеводов,
  "ingredients": ["ингредиент1", "ингредиент2", ...],
  "confidence": число_от_1_до_100
}}
"""

CLASSIFY_PROMPT = """Определи тип изображения. Ответь ОДНИМ словом:
- food — если на фото еда, блюдо, напиток, продукты
- data — если на фото цифровые данные (весы, анализы, показатели здоровья, скриншот трекера)
- other — всё остальное

Ответ (одно слово):"""

CLASSIFY_AND_ANALYZE_PROMPT = """Посмотри на фото и определи его тип.

Если это ЕДА (блюдо, напиток, продукты) — верни JSON анализа:
{
  "type": "food",
  "dish_name": "название блюда",
  "dish_type": "тип (завтрак/обед/ужин/перекус)",
  "calories": число_ккал,
  "proteins": граммы_белка,
  "fats": граммы_жиров,
  "carbohydrates": граммы_углеводов,
  "ingredients": ["ингредиент1", "ингредиент2"],
  "confidence": число_от_1_до_100
}

Если это ДАННЫЕ (весы, анализы, показатели здоровья) — верни:
{"type": "data"}

Если это ДРУГОЕ — верни:
{"type": "other"}

Верни только JSON без markdown-обёртки."""

ANALYZE_FOOD_PROMPT = """Проанализируй фото еды и верни JSON (без markdown-обёртки, только чистый JSON):
{
  "dish_name": "название блюда",
  "dish_type": "тип (завтрак/обед/ужин/перекус)",
  "calories": число_ккал,
  "proteins": граммы_белка,
  "fats": граммы_жиров,
  "carbohydrates": граммы_углеводов,
  "ingredients": ["ингредиент1", "ингредиент2"],
  "confidence": число_от_1_до_100
}

Оценивай порцию по визуальному размеру. Если не уверен — дай приблизительные значения.
"""


async def _get_vision_provider(bot: TelegramBot, client: Client = None):
    """Get vision AI provider for the bot's coach.

    Uses client's persona if available, otherwise falls back to coach's default persona.
    """
    logger.info('[VISION] Getting provider for bot=%s coach=%s client=%s', bot.pk, bot.coach_id, client.pk if client else None)

    # Try client's persona first, then fallback to coach's default
    persona = None
    if client:
        persona = await sync_to_async(lambda: client.persona)()
        if persona:
            logger.info('[VISION] Using client persona=%s', persona.pk)

    if not persona:
        persona = await sync_to_async(
            lambda: BotPersona.objects.filter(coach=bot.coach).first()
        )()
        if persona:
            logger.info('[VISION] Using coach default persona=%s', persona.pk)

    if not persona:
        logger.error('[VISION] No BotPersona for coach=%s', bot.coach_id)
        raise ValueError(f'No BotPersona configured for coach {bot.coach_id}')

    provider_name = persona.vision_provider or persona.text_provider or 'openai'
    model = persona.vision_model or persona.text_model or None

    logger.info('[VISION] Using provider=%s model=%s', provider_name, model)

    config = await sync_to_async(
        lambda: AIProviderConfig.objects.filter(
            coach=bot.coach, provider=provider_name, is_active=True
        ).first()
    )()
    if not config:
        logger.error('[VISION] No API config for provider=%s coach=%s', provider_name, bot.coach_id)
        raise ValueError(f'No API key for provider: {provider_name}')

    provider = get_ai_provider(provider_name, config.api_key)
    logger.info('[VISION] Provider ready: %s', provider_name)
    return provider, provider_name, model, persona


async def classify_image(bot: TelegramBot, image_data: bytes) -> str:
    """Classify image as food/data/other using AI vision."""
    provider, provider_name, model, persona = await _get_vision_provider(bot)

    response = await provider.analyze_image(
        image_data=image_data,
        prompt=CLASSIFY_PROMPT,
        max_tokens=10,
        model=model,
    )

    # Log usage
    from core.ai.model_fetcher import get_cached_pricing
    from decimal import Decimal

    model_used = response.model or model or ''
    input_tokens = response.usage.get('input_tokens') or response.usage.get('prompt_tokens') or 0
    output_tokens = response.usage.get('output_tokens') or response.usage.get('completion_tokens') or 0

    cost_usd = Decimal('0')
    pricing = get_cached_pricing(provider_name, model_used)
    if pricing and (input_tokens or output_tokens):
        price_in, price_out = pricing
        cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

    await sync_to_async(AIUsageLog.objects.create)(
        coach=bot.coach,
        provider=provider_name,
        model=model_used,
        task_type='vision',
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    result = response.content.strip().lower()

    # Normalize response
    if 'food' in result:
        return 'food'
    elif 'data' in result:
        return 'data'
    return 'other'


async def classify_and_analyze(bot: TelegramBot, image_data: bytes, caption: str = '') -> dict:
    """Classify image and analyze if food — single AI call.

    Returns dict with 'type' key and analysis data if food.
    """
    provider, provider_name, model, persona = await _get_vision_provider(bot)

    prompt = CLASSIFY_AND_ANALYZE_PROMPT
    if caption:
        prompt += f'\n\nПодпись пользователя: "{caption}"'

    response = await provider.analyze_image(
        image_data=image_data,
        prompt=prompt,
        max_tokens=500,
        model=model,
    )

    # Log usage with cost calculation
    from core.ai.model_fetcher import get_cached_pricing
    from decimal import Decimal

    model_used = response.model or model or ''
    input_tokens = response.usage.get('input_tokens', 0) or response.usage.get('prompt_tokens', 0)
    output_tokens = response.usage.get('output_tokens', 0) or response.usage.get('completion_tokens', 0)

    cost_usd = Decimal('0')
    pricing = get_cached_pricing(provider_name, model_used)
    if pricing and (input_tokens or output_tokens):
        price_in, price_out = pricing
        cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

    await sync_to_async(AIUsageLog.objects.create)(
        coach=bot.coach,
        provider=provider_name,
        model=model_used,
        task_type='vision',
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    # Parse JSON from response
    content = response.content.strip()
    if content.startswith('```'):
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.error('Failed to parse classify_and_analyze JSON: %s', content)
        return {'type': 'other'}

    # Add meta for food analysis
    if data.get('type') == 'food':
        data['_meta'] = {
            'provider': provider_name,
            'model': response.model or model or '',
            'usage': response.usage or {},
            'response_id': response.response_id or '',
            'raw_content': response.content,
        }

    return data


async def analyze_food(bot: TelegramBot, image_data: bytes, caption: str = '') -> dict:
    """Analyze food photo and return structured nutrition data.

    Returns dict with keys: analysis data + _meta with provider info.
    """
    provider, provider_name, model, persona = await _get_vision_provider(bot)

    prompt = ANALYZE_FOOD_PROMPT
    if caption:
        prompt += f'\n\nПодпись пользователя: "{caption}"'

    response = await provider.analyze_image(
        image_data=image_data,
        prompt=prompt,
        max_tokens=500,
        model=model,
    )

    # Log usage with cost calculation
    from core.ai.model_fetcher import get_cached_pricing
    from decimal import Decimal

    model_used = response.model or model or ''
    input_tokens = response.usage.get('input_tokens', 0) or response.usage.get('prompt_tokens', 0)
    output_tokens = response.usage.get('output_tokens', 0) or response.usage.get('completion_tokens', 0)

    cost_usd = Decimal('0')
    pricing = get_cached_pricing(provider_name, model_used)
    if pricing and (input_tokens or output_tokens):
        price_in, price_out = pricing
        cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

    await sync_to_async(AIUsageLog.objects.create)(
        coach=bot.coach,
        provider=provider_name,
        model=model_used,
        task_type='vision',
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    # Parse JSON from response
    content = response.content.strip()
    # Strip markdown code block if present
    if content.startswith('```'):
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.error('Failed to parse food analysis JSON: %s', content)
        data = {
            'dish_name': 'Неизвестное блюдо',
            'calories': 0,
            'proteins': 0,
            'fats': 0,
            'carbohydrates': 0,
        }

    data['_meta'] = {
        'provider': provider_name,
        'model': response.model or model or '',
        'usage': response.usage or {},
        'response_id': response.response_id or '',
        'raw_content': response.content,
    }

    return data


async def save_meal(client: Client, image_data: bytes, analysis: dict) -> Meal:
    """Save analyzed meal to database with image."""
    now = timezone.now()

    meal = await sync_to_async(Meal.objects.create)(
        client=client,
        image_type='food',
        dish_name=analysis.get('dish_name', 'Неизвестное блюдо'),
        dish_type=analysis.get('dish_type', ''),
        calories=analysis.get('calories'),
        proteins=analysis.get('proteins'),
        fats=analysis.get('fats'),
        carbohydrates=analysis.get('carbohydrates'),
        ingredients=analysis.get('ingredients', []),
        ai_confidence=analysis.get('confidence'),
        meal_time=now,
    )

    # Save image
    if image_data:
        filename = f'meal_{meal.pk}_{now.strftime("%Y%m%d_%H%M%S")}.jpg'
        await sync_to_async(meal.image.save)(filename, ContentFile(image_data), save=True)

    return meal


async def get_daily_summary(client: Client, target_date: date = None) -> dict:
    """Calculate daily nutrition summary: consumed vs remaining."""
    import zoneinfo

    # Use client's timezone for "today" calculation
    client_obj = await sync_to_async(lambda: Client.objects.get(pk=client.pk))()
    try:
        client_tz = zoneinfo.ZoneInfo(client_obj.timezone or 'Europe/Moscow')
    except Exception:
        client_tz = zoneinfo.ZoneInfo('Europe/Moscow')

    if target_date is None:
        # Get current date in client's timezone
        now_in_client_tz = timezone.now().astimezone(client_tz)
        target_date = now_in_client_tz.date()

    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)

    # Make timezone-aware using client's timezone
    day_start = day_start.replace(tzinfo=client_tz)
    day_end = day_end.replace(tzinfo=client_tz)

    meals = await sync_to_async(
        lambda: list(
            Meal.objects.filter(
                client=client,
                image_type='food',
                meal_time__range=(day_start, day_end),
            )
        )
    )()

    consumed = {
        'calories': sum(m.calories or 0 for m in meals),
        'proteins': sum(m.proteins or 0 for m in meals),
        'fats': sum(m.fats or 0 for m in meals),
        'carbohydrates': sum(m.carbohydrates or 0 for m in meals),
        'meals_count': len(meals),
    }

    # Client norms (client_obj already fetched above for timezone)
    norms = {
        'calories': client_obj.daily_calories or 2000,
        'proteins': client_obj.daily_proteins or 80,
        'fats': client_obj.daily_fats or 70,
        'carbohydrates': client_obj.daily_carbs or 250,
    }

    remaining = {
        'calories': round(norms['calories'] - consumed['calories'], 1),
        'proteins': round(norms['proteins'] - consumed['proteins'], 1),
        'fats': round(norms['fats'] - consumed['fats'], 1),
        'carbohydrates': round(norms['carbohydrates'] - consumed['carbohydrates'], 1),
    }

    return {
        'date': target_date.isoformat(),
        'consumed': consumed,
        'norms': norms,
        'remaining': remaining,
    }


def format_meal_response(analysis: dict, summary: dict) -> str:
    """Format meal analysis + daily summary for Telegram response."""
    name = analysis.get('dish_name', 'Блюдо')
    cal = analysis.get('calories', 0)
    prot = analysis.get('proteins', 0)
    fat = analysis.get('fats', 0)
    carb = analysis.get('carbohydrates', 0)

    remaining = summary.get('remaining', {})
    r_cal = remaining.get('calories', 0)
    r_prot = remaining.get('proteins', 0)
    r_fat = remaining.get('fats', 0)
    r_carb = remaining.get('carbohydrates', 0)

    meals_count = summary.get('consumed', {}).get('meals_count', 0)

    text = (
        f'*{name}*\n'
        f'Ккал: {cal} | Б: {prot} | Ж: {fat} | У: {carb}\n'
        f'\n'
        f'Приём пищи #{meals_count} за сегодня\n'
        f'Остаток на день:\n'
        f'Ккал: {r_cal} | Б: {r_prot} | Ж: {r_fat} | У: {r_carb}'
    )

    return text


async def get_recent_meal(client: Client) -> Meal | None:
    """Get client's most recent meal within correction window."""
    from django.utils import timezone as tz
    import datetime

    cutoff = tz.now() - datetime.timedelta(minutes=MEAL_CORRECTION_WINDOW_MINUTES)
    meal = await sync_to_async(
        lambda: Meal.objects.filter(
            client=client,
            image_type='food',
            created_at__gte=cutoff,
        ).first()
    )()
    return meal


async def is_meal_correction(bot: TelegramBot, meal: Meal, user_text: str) -> bool:
    """Ask AI if user's text is a correction to the recent meal."""
    provider, provider_name, model, persona = await _get_vision_provider(bot)

    prompt = CLASSIFY_CORRECTION_PROMPT.format(
        dish_name=meal.dish_name,
        calories=meal.calories or 0,
        proteins=meal.proteins or 0,
        fats=meal.fats or 0,
        carbs=meal.carbohydrates or 0,
        user_text=user_text,
    )

    response = await provider.complete(
        messages=[{'role': 'user', 'content': prompt}],
        system_prompt='Ответь ОДНИМ словом: YES или NO.',
        max_tokens=5,
        temperature=0,
        model=model,
    )

    # Log usage
    from core.ai.model_fetcher import get_cached_pricing
    from decimal import Decimal

    model_used = response.model or model or ''
    input_tokens = response.usage.get('input_tokens') or response.usage.get('prompt_tokens') or 0
    output_tokens = response.usage.get('output_tokens') or response.usage.get('completion_tokens') or 0

    cost_usd = Decimal('0')
    pricing = get_cached_pricing(provider_name, model_used)
    if pricing and (input_tokens or output_tokens):
        price_in, price_out = pricing
        cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

    await sync_to_async(AIUsageLog.objects.create)(
        coach=bot.coach,
        provider=provider_name,
        model=model_used,
        task_type='text',
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    return 'yes' in response.content.strip().lower()


async def analyze_food_for_client(client: Client, image_data: bytes, caption: str = '') -> dict:
    """Analyze food photo for miniapp client.

    Gets vision provider through client's coach and returns nutrition data + AI response text.
    """
    import time
    from apps.chat.models import InteractionLog
    from core.ai.factory import get_ai_provider
    from core.ai.model_fetcher import get_cached_pricing
    from decimal import Decimal

    start_time = time.time()

    logger.info('[ANALYZE] Starting for client=%s coach=%s', client.pk, client.coach_id)

    # Get client's bot/coach to access AI provider
    bot = await sync_to_async(
        lambda: TelegramBot.objects.filter(coach=client.coach).first()
    )()
    if not bot:
        logger.error('[ANALYZE] No bot for coach=%s', client.coach_id)
        raise ValueError('No bot configured for client coach')

    logger.info('[ANALYZE] Found bot=%s', bot.pk)

    provider, provider_name, model, persona = await _get_vision_provider(bot, client)

    prompt = ANALYZE_FOOD_PROMPT
    if caption:
        prompt += f'\n\nУточнение от пользователя: "{caption}"'

    logger.info('[ANALYZE] Calling AI analyze_image with model=%s', model)

    response = await provider.analyze_image(
        image_data=image_data,
        prompt=prompt,
        max_tokens=500,
        model=model,
    )

    logger.info('[ANALYZE] AI response received, content length=%d', len(response.content or ''))

    # Log usage with cost calculation
    model_used = response.model or model or ''
    input_tokens = response.usage.get('input_tokens', 0) or response.usage.get('prompt_tokens', 0)
    output_tokens = response.usage.get('output_tokens', 0) or response.usage.get('completion_tokens', 0)

    cost_usd = Decimal('0')
    pricing = get_cached_pricing(provider_name, model_used)
    if pricing and (input_tokens or output_tokens):
        price_in, price_out = pricing
        cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

    await sync_to_async(AIUsageLog.objects.create)(
        coach=client.coach,
        provider=provider_name,
        model=model_used,
        task_type='vision',
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    # Parse JSON from response
    content = response.content.strip()
    if content.startswith('```'):
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.error('Failed to parse food analysis JSON for client: %s', content)
        data = {
            'dish_name': 'Неизвестное блюдо',
            'dish_type': 'snack',
            'calories': 0,
            'proteins': 0,
            'fats': 0,
            'carbohydrates': 0,
        }

    # Generate AI response text with recommendations (like in Telegram)
    text_model_used = None
    text_provider_name = None

    if persona.food_response_prompt:
        # Get daily summary for context
        summary = await get_daily_summary(client)

        # Get text provider
        text_provider_name = persona.text_provider or provider_name
        text_model = persona.text_model or None

        config = await sync_to_async(
            lambda: AIProviderConfig.objects.filter(
                coach=bot.coach, provider=text_provider_name, is_active=True
            ).first()
        )()
        if config:
            text_provider = get_ai_provider(text_provider_name, config.api_key)

            # Build context
            user_message = (
                f'Данные анализа еды:\n'
                f'{json.dumps(data, ensure_ascii=False)}\n\n'
                f'Дневная сводка:\n'
                f'{json.dumps(summary, ensure_ascii=False)}'
            )
            if caption:
                user_message = f'Подпись пользователя: "{caption}"\n\n' + user_message

            text_response = await text_provider.complete(
                messages=[{'role': 'user', 'content': user_message}],
                system_prompt=persona.food_response_prompt,
                max_tokens=persona.max_tokens,
                temperature=persona.temperature,
                model=text_model,
            )

            # Log text generation usage
            text_model_used = text_response.model or text_model or ''
            text_input = text_response.usage.get('input_tokens', 0) or text_response.usage.get('prompt_tokens', 0)
            text_output = text_response.usage.get('output_tokens', 0) or text_response.usage.get('completion_tokens', 0)

            text_cost = Decimal('0')
            text_pricing = get_cached_pricing(text_provider_name, text_model_used)
            if text_pricing and (text_input or text_output):
                price_in, price_out = text_pricing
                text_cost = Decimal(str((text_input * price_in + text_output * price_out) / 1_000_000))

            await sync_to_async(AIUsageLog.objects.create)(
                coach=client.coach,
                provider=text_provider_name,
                model=text_model_used,
                task_type='text',
                input_tokens=text_input,
                output_tokens=text_output,
                cost_usd=text_cost,
            )

            data['ai_response'] = text_response.content
        else:
            logger.warning(
                '[ANALYZE] No API config for text provider %s, skipping AI response',
                text_provider_name
            )

    # Always log interaction
    duration_ms = int((time.time() - start_time) * 1000)
    await sync_to_async(InteractionLog.objects.create)(
        client=client,
        coach=client.coach,
        interaction_type='vision',
        client_input=caption or '[Miniapp: Фото еды]',
        ai_request={
            'source': 'miniapp',
            'vision_prompt': ANALYZE_FOOD_PROMPT,
            'text_prompt': persona.food_response_prompt if persona.food_response_prompt else None,
            'caption': caption,
        },
        ai_response={
            'analysis': data,
            'ai_response': data.get('ai_response'),
            'vision_model': model_used,
            'text_model': text_model_used,
        },
        client_output=data.get('ai_response') or json.dumps(data, ensure_ascii=False),
        provider=text_provider_name or provider_name,
        model=text_model_used or model_used,
        duration_ms=duration_ms,
    )

    return data


async def recalculate_meal_for_client(client: Client, previous_analysis: dict, correction: str) -> dict:
    """Recalculate meal nutrition for miniapp based on user correction.

    Returns updated analysis with ai_response.
    """
    import time
    from apps.chat.models import InteractionLog
    from core.ai.factory import get_ai_provider
    from core.ai.model_fetcher import get_cached_pricing
    from decimal import Decimal

    start_time = time.time()

    logger.info(
        '[RECALCULATE] Starting: client=%s, correction="%s", previous=%s',
        client.pk, correction, previous_analysis
    )

    # Get client's bot/coach to access AI provider
    bot = await sync_to_async(
        lambda: TelegramBot.objects.filter(coach=client.coach).first()
    )()
    if not bot:
        raise ValueError('No bot configured for client coach')

    # Get persona - client's persona or coach's default
    persona = await sync_to_async(lambda: client.persona)()
    if not persona:
        persona = await sync_to_async(
            lambda: BotPersona.objects.filter(coach=bot.coach).first()
        )()
    if not persona:
        raise ValueError(f'No BotPersona configured for coach {bot.coach_id}')

    # Use TEXT provider for recalculation (not vision)
    provider_name = persona.text_provider or persona.vision_provider or 'openai'
    model = persona.text_model or persona.vision_model or None

    config = await sync_to_async(
        lambda: AIProviderConfig.objects.filter(
            coach=bot.coach, provider=provider_name, is_active=True
        ).first()
    )()
    if not config:
        raise ValueError(f'No API key for provider: {provider_name}')

    provider = get_ai_provider(provider_name, config.api_key)

    # Build prompt with previous analysis
    prompt = RECALCULATE_MINIAPP_PROMPT.format(
        dish_name=previous_analysis.get('dish_name', 'Неизвестное блюдо'),
        dish_type=previous_analysis.get('dish_type', ''),
        calories=previous_analysis.get('calories', 0),
        proteins=previous_analysis.get('proteins', 0),
        fats=previous_analysis.get('fats', 0),
        carbs=previous_analysis.get('carbohydrates', 0),
        ingredients=', '.join(previous_analysis.get('ingredients', [])),
        correction=correction,
    )

    logger.info('[RECALCULATE] Using provider=%s model=%s', provider_name, model)
    logger.info('[RECALCULATE] Prompt: %s', prompt[:500])

    response = await provider.complete(
        messages=[{'role': 'user', 'content': prompt}],
        system_prompt='Верни только JSON.',
        max_tokens=300,
        temperature=0.2,
        model=model,
    )

    logger.info('[RECALCULATE] AI raw response: %s', response.content)

    # Log usage
    model_used = response.model or model or ''
    input_tokens = response.usage.get('input_tokens', 0) or response.usage.get('prompt_tokens', 0)
    output_tokens = response.usage.get('output_tokens', 0) or response.usage.get('completion_tokens', 0)

    cost_usd = Decimal('0')
    pricing = get_cached_pricing(provider_name, model_used)
    if pricing and (input_tokens or output_tokens):
        price_in, price_out = pricing
        cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

    await sync_to_async(AIUsageLog.objects.create)(
        coach=client.coach,
        provider=provider_name,
        model=model_used,
        task_type='text',
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    # Parse JSON
    content = response.content.strip()
    if content.startswith('```'):
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

    try:
        data = json.loads(content)
        logger.info('[RECALCULATE] Parsed data: %s', data)
    except json.JSONDecodeError:
        logger.error('[RECALCULATE] Failed to parse JSON: %s', content)
        # Return previous analysis if parsing fails
        return previous_analysis

    # Generate AI response text with recommendations
    if persona.food_response_prompt:
        summary = await get_daily_summary(client)

        text_provider_name = persona.text_provider or provider_name
        text_model = persona.text_model or None

        config = await sync_to_async(
            lambda: AIProviderConfig.objects.filter(
                coach=bot.coach, provider=text_provider_name, is_active=True
            ).first()
        )()
        if config:
            text_provider = get_ai_provider(text_provider_name, config.api_key)

            user_message = (
                f'Данные анализа еды (после уточнения пользователя: "{correction}"):\n'
                f'{json.dumps(data, ensure_ascii=False)}\n\n'
                f'Дневная сводка:\n'
                f'{json.dumps(summary, ensure_ascii=False)}'
            )

            text_response = await text_provider.complete(
                messages=[{'role': 'user', 'content': user_message}],
                system_prompt=persona.food_response_prompt,
                max_tokens=persona.max_tokens,
                temperature=persona.temperature,
                model=text_model,
            )

            # Log text generation usage
            text_model_used = text_response.model or text_model or ''
            text_input = text_response.usage.get('input_tokens', 0) or text_response.usage.get('prompt_tokens', 0)
            text_output = text_response.usage.get('output_tokens', 0) or text_response.usage.get('completion_tokens', 0)

            text_cost = Decimal('0')
            text_pricing = get_cached_pricing(text_provider_name, text_model_used)
            if text_pricing and (text_input or text_output):
                price_in, price_out = text_pricing
                text_cost = Decimal(str((text_input * price_in + text_output * price_out) / 1_000_000))

            await sync_to_async(AIUsageLog.objects.create)(
                coach=client.coach,
                provider=text_provider_name,
                model=text_model_used,
                task_type='text',
                input_tokens=text_input,
                output_tokens=text_output,
                cost_usd=text_cost,
            )

            data['ai_response'] = text_response.content

    # Log interaction
    duration_ms = int((time.time() - start_time) * 1000)
    await sync_to_async(InteractionLog.objects.create)(
        client=client,
        coach=client.coach,
        interaction_type='text',
        client_input=f'[Miniapp: Уточнение] {correction}',
        ai_request={
            'source': 'miniapp_recalculate',
            'recalculate_prompt': prompt,
            'previous_analysis': previous_analysis,
            'correction': correction,
        },
        ai_response={
            'analysis': data,
            'ai_response': data.get('ai_response', ''),
            'model': model_used,
        },
        client_output=data.get('ai_response', json.dumps(data, ensure_ascii=False)),
        provider=provider_name,
        model=model_used,
        duration_ms=duration_ms,
    )

    logger.info(
        '[RECALCULATE] client=%s correction="%s" duration=%dms',
        client.pk, correction[:50], duration_ms
    )

    return data


async def recalculate_meal(bot: TelegramBot, meal: Meal, user_text: str) -> dict:
    """Recalculate meal nutrition based on user correction."""
    provider, provider_name, model, persona = await _get_vision_provider(bot)

    prompt = RECALCULATE_PROMPT.format(
        dish_name=meal.dish_name,
        calories=meal.calories or 0,
        proteins=meal.proteins or 0,
        fats=meal.fats or 0,
        carbs=meal.carbohydrates or 0,
        user_text=user_text,
    )

    response = await provider.complete(
        messages=[{'role': 'user', 'content': prompt}],
        system_prompt='Верни только JSON.',
        max_tokens=200,
        temperature=0.2,
        model=model,
    )

    # Log usage
    from core.ai.model_fetcher import get_cached_pricing
    from decimal import Decimal

    model_used = response.model or model or ''
    input_tokens = response.usage.get('input_tokens') or response.usage.get('prompt_tokens') or 0
    output_tokens = response.usage.get('output_tokens') or response.usage.get('completion_tokens') or 0

    cost_usd = Decimal('0')
    pricing = get_cached_pricing(provider_name, model_used)
    if pricing and (input_tokens or output_tokens):
        price_in, price_out = pricing
        cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

    await sync_to_async(AIUsageLog.objects.create)(
        coach=bot.coach,
        provider=provider_name,
        model=model_used,
        task_type='text',
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    # Parse JSON
    content = response.content.strip()
    if content.startswith('```'):
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.error('Failed to parse recalculation JSON: %s', content)
        return {}

    # Update meal
    meal.dish_name = data.get('dish_name', meal.dish_name)
    meal.dish_type = data.get('dish_type', meal.dish_type)
    meal.calories = data.get('calories', meal.calories)
    meal.proteins = data.get('proteins', meal.proteins)
    meal.fats = data.get('fats', meal.fats)
    meal.carbohydrates = data.get('carbohydrates', meal.carbohydrates)
    await sync_to_async(meal.save)()

    return data
