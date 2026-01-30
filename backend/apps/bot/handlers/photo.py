import json
import logging
import random
import time

from asgiref.sync import sync_to_async

# Связующие фразы после "Анализирую..."
ANALYSIS_INTRO_PHRASES = [
    'Готово! Вот что я вижу:',
    'Разобрался! Смотри:',
    'Так, понял что тут:',
    'Ага, вот что получилось:',
    'Всё, разглядел:',
    'Окей, вижу тут:',
]

from apps.accounts.models import Client
from apps.chat.models import InteractionLog
from apps.meals.services import (
    analyze_food,
    classify_and_analyze,
    classify_image,
    format_meal_response,
    get_daily_summary,
    save_meal,
    ANALYZE_FOOD_PROMPT,
)
from apps.metrics.services import (
    format_metrics_response,
    parse_metrics_from_photo,
    save_metrics,
)
from apps.persona.models import TelegramBot

from ..telegram_api import get_file, send_chat_action, send_message, send_notification
from ..services import get_ai_vision_response, _get_persona, _get_api_key

logger = logging.getLogger(__name__)


async def handle_photo(bot: TelegramBot, client: Client, message: dict):
    """Handle incoming photo message with classification."""
    chat_id = message['chat']['id']
    total_start = time.time()

    photos = message.get('photo')
    if not photos:
        return

    # Get the largest photo (last in the array)
    file_id = photos[-1]['file_id']
    caption = message.get('caption', '')

    await send_chat_action(bot.token, chat_id)

    try:
        # Download photo
        image_data = await get_file(bot.token, file_id)
        if not image_data:
            await send_message(bot.token, chat_id, 'Не удалось загрузить фото.')
            return

        # Send acknowledgment message
        await send_message(bot.token, chat_id, '📸 Фото получил! Анализирую, это займёт около минуты...')

        # Classify and analyze in one call
        result = await classify_and_analyze(bot, image_data, caption)
        image_type = result.get('type', 'other')

        if image_type == 'food':
            # Already have analysis from classify_and_analyze
            await _handle_food_photo_with_analysis(bot, client, chat_id, image_data, caption, result, total_start)
        elif image_type == 'data':
            await _handle_data_photo(bot, client, chat_id, image_data)
            total_ms = int((time.time() - total_start) * 1000)
            logger.info('[PHOTO] client=%s type=data total=%dms requests=1', client.pk, total_ms)
        else:
            # Generic AI vision response for non-food photos
            response_text = await get_ai_vision_response(bot, client, image_data, caption)
            await send_message(bot.token, chat_id, response_text)
            total_ms = int((time.time() - total_start) * 1000)
            logger.info('[PHOTO] client=%s type=other total=%dms requests=2', client.pk, total_ms)

    except Exception as e:
        logger.exception('Error handling photo for client %s: %s', client.pk, e)
        await send_message(bot.token, chat_id, 'Произошла ошибка. Попробуйте позже.')


async def _handle_food_photo_with_analysis(bot: TelegramBot, client: Client, chat_id: int, image_data: bytes, caption: str, analysis: dict, total_start: float = None):
    """Handle food photo with pre-computed analysis from classify_and_analyze."""
    from decimal import Decimal
    from core.ai.factory import get_ai_provider
    from core.ai.model_fetcher import get_cached_pricing

    start_time = time.time()
    if total_start is None:
        total_start = start_time

    # Extract meta before saving (contains stats from classify_and_analyze)
    meta = analysis.pop('_meta', {})

    # Stats from first AI call (classify_and_analyze)
    first_call_input = meta.get('usage', {}).get('input_tokens') or meta.get('usage', {}).get('prompt_tokens') or 0
    first_call_output = meta.get('usage', {}).get('output_tokens') or meta.get('usage', {}).get('completion_tokens') or 0

    logger.info(
        '[PHOTO] Saving meal: client=%s (%s) dish="%s"',
        client.pk, client.telegram_username, analysis.get('dish_name', 'unknown')
    )
    try:
        meal = await save_meal(client, image_data, analysis)
        logger.info('[PHOTO] Meal saved: client=%s meal_id=%s', client.pk, meal.pk)
    except Exception as e:
        logger.exception('[PHOTO] Failed to save meal: client=%s error=%s', client.pk, str(e))
        raise

    summary = await get_daily_summary(client)

    # Check if persona has food_response_prompt
    persona = await _get_persona(bot, client)

    if persona.food_response_prompt:
        # Generate rich AI response using food_response_prompt
        provider_name = persona.text_provider or meta.get('provider', 'openai')
        model_name = persona.text_model or None
        api_key = await _get_api_key(bot.coach, provider_name)
        provider = get_ai_provider(provider_name, api_key)

        # Build context with analysis data and daily summary
        user_message = (
            f'Данные анализа еды:\n'
            f'{json.dumps(analysis, ensure_ascii=False)}\n\n'
            f'Дневная сводка:\n'
            f'{json.dumps(summary, ensure_ascii=False)}'
        )
        if caption:
            user_message = f'Подпись пользователя: "{caption}"\n\n' + user_message

        # Add instruction to start with a transition phrase
        intro_instruction = (
            '\n\nВАЖНО: Пользователь уже получил сообщение "Фото получил, анализирую...". '
            'Начни ответ с короткой естественной фразы-перехода вроде "Готово!", "Так, вижу тут...", '
            '"Разобрался!" или подобной — чтобы связать с предыдущим сообщением. '
            'Каждый раз используй разные варианты.'
        )

        response = await provider.complete(
            messages=[{'role': 'user', 'content': user_message}],
            system_prompt=persona.food_response_prompt + intro_instruction,
            max_tokens=persona.max_tokens,
            temperature=persona.temperature,
            model=model_name,
        )
        duration_ms = int((time.time() - start_time) * 1000)
        response_text = response.content
        response_model = response.model or model_name or ''
        response_provider = provider_name

        # Log usage with cost calculation
        from apps.persona.models import AIUsageLog

        second_call_input = response.usage.get('input_tokens') or response.usage.get('prompt_tokens') or 0
        second_call_output = response.usage.get('output_tokens') or response.usage.get('completion_tokens') or 0

        cost_usd = Decimal('0')
        pricing = get_cached_pricing(provider_name, response_model)
        if pricing and (second_call_input or second_call_output):
            price_in, price_out = pricing
            cost_usd = Decimal(str((second_call_input * price_in + second_call_output * price_out) / 1_000_000))

        # Stats for logging
        total_input_tokens = first_call_input + second_call_input
        total_output_tokens = first_call_output + second_call_output
        ai_requests_count = 2

        await sync_to_async(AIUsageLog.objects.create)(
            coach=bot.coach,
            client=client,
            provider=provider_name,
            model=response_model,
            task_type='text',
            input_tokens=second_call_input,
            output_tokens=second_call_output,
            cost_usd=cost_usd,
        )

        ai_request_log = {
            'system_prompt': persona.food_response_prompt,
            'messages': [{'role': 'user', 'content': user_message}],
            'provider': provider_name,
            'model': model_name or '',
            'temperature': persona.temperature,
            'max_tokens': persona.max_tokens,
        }
        ai_response_log = {
            'content': response.content,
            'model': response.model or '',
            'usage': response.usage or {},
            'response_id': response.response_id or '',
            'analysis': analysis,
        }
    else:
        # Fallback to template response (no extra AI call)
        intro = random.choice(ANALYSIS_INTRO_PHRASES)
        response_text = f'{intro}\n\n{format_meal_response(analysis, summary)}'
        duration_ms = int((time.time() - start_time) * 1000)
        response_provider = meta.get('provider', '')
        response_model = meta.get('model', '')

        # Stats for logging (only first call, no second)
        total_input_tokens = first_call_input
        total_output_tokens = first_call_output
        ai_requests_count = 1
        cost_usd = Decimal('0')  # No second call cost

        ai_request_log = {
            'prompt': 'classify_and_analyze (combined)',
            'provider': response_provider,
            'model': response_model,
            'max_tokens': 500,
        }
        ai_response_log = {
            'analysis': analysis,
            'raw_content': meta.get('raw_content', ''),
            'usage': meta.get('usage', {}),
            'response_id': meta.get('response_id', ''),
        }

    await send_message(bot.token, chat_id, response_text)

    # Сохраняем AI комментарий в meal
    if persona.food_response_prompt and response_text:
        meal.ai_comment = response_text
        await sync_to_async(meal.save)(update_fields=['ai_comment'])

    # Send notification to coach's report chat
    await _notify_coach_about_meal(bot, client, analysis, summary)

    # Log interaction
    await sync_to_async(InteractionLog.objects.create)(
        client=client,
        coach=bot.coach,
        interaction_type='vision',
        client_input=caption or '[Фото еды]',
        ai_request=ai_request_log,
        ai_response=ai_response_log,
        client_output=response_text,
        provider=response_provider,
        model=response_model,
        duration_ms=duration_ms,
    )

    # Log detailed stats
    total_ms = int((time.time() - total_start) * 1000)

    # Calculate total cost (first call from classify_and_analyze + second call if any)
    first_call_cost = 0.0
    first_provider = meta.get('provider', '')
    first_model = meta.get('model', '')
    if first_call_input or first_call_output:
        first_pricing = get_cached_pricing(first_provider, first_model)
        if first_pricing:
            price_in, price_out = first_pricing
            first_call_cost = (first_call_input * price_in + first_call_output * price_out) / 1_000_000

    total_cost = first_call_cost + float(cost_usd)

    logger.info(
        '[PHOTO] client=%s type=food total=%dms requests=%d tokens_in=%d tokens_out=%d cost=$%.6f model=%s',
        client.pk, total_ms, ai_requests_count,
        total_input_tokens, total_output_tokens, total_cost, response_model
    )


async def _handle_food_photo(bot: TelegramBot, client: Client, chat_id: int, image_data: bytes, caption: str):
    """Analyze food photo, save meal, return nutrition summary."""
    from core.ai.factory import get_ai_provider

    start_time = time.time()
    analysis = await analyze_food(bot, image_data, caption)
    duration_ms_analysis = int((time.time() - start_time) * 1000)

    # Extract meta before saving
    meta = analysis.pop('_meta', {})

    meal = await save_meal(client, image_data, analysis)
    summary = await get_daily_summary(client)

    # Check if persona has food_response_prompt
    persona = await _get_persona(bot, client)

    if persona.food_response_prompt:
        # Generate rich AI response using food_response_prompt
        provider_name = persona.text_provider or meta.get('provider', 'openai')
        model_name = persona.text_model or None
        api_key = await _get_api_key(bot.coach, provider_name)
        provider = get_ai_provider(provider_name, api_key)

        # Build context with analysis data and daily summary
        user_message = (
            f'Данные анализа еды:\n'
            f'{json.dumps(analysis, ensure_ascii=False)}\n\n'
            f'Дневная сводка:\n'
            f'{json.dumps(summary, ensure_ascii=False)}'
        )
        if caption:
            user_message = f'Подпись пользователя: "{caption}"\n\n' + user_message

        # Add instruction to start with a transition phrase
        intro_instruction = (
            '\n\nВАЖНО: Пользователь уже получил сообщение "Фото получил, анализирую...". '
            'Начни ответ с короткой естественной фразы-перехода вроде "Готово!", "Так, вижу тут...", '
            '"Разобрался!" или подобной — чтобы связать с предыдущим сообщением. '
            'Каждый раз используй разные варианты.'
        )

        start_response = time.time()
        response = await provider.complete(
            messages=[{'role': 'user', 'content': user_message}],
            system_prompt=persona.food_response_prompt + intro_instruction,
            max_tokens=persona.max_tokens,
            temperature=persona.temperature,
            model=model_name,
        )
        duration_ms = duration_ms_analysis + int((time.time() - start_response) * 1000)
        response_text = response.content
        response_model = response.model or model_name or ''
        response_provider = provider_name

        # Log usage for second (text) call
        from apps.persona.models import AIUsageLog
        from core.ai.model_fetcher import get_cached_pricing
        from decimal import Decimal

        second_call_input = response.usage.get('input_tokens') or response.usage.get('prompt_tokens') or 0
        second_call_output = response.usage.get('output_tokens') or response.usage.get('completion_tokens') or 0

        second_cost = Decimal('0')
        pricing = get_cached_pricing(response_provider, response_model)
        if pricing and (second_call_input or second_call_output):
            price_in, price_out = pricing
            second_cost = Decimal(str((second_call_input * price_in + second_call_output * price_out) / 1_000_000))
        elif second_call_input or second_call_output:
            logger.warning(
                '[PHOTO LEGACY] Missing pricing for provider=%s model=%s, tokens_in=%s tokens_out=%s',
                response_provider, response_model, second_call_input, second_call_output
            )

        await sync_to_async(AIUsageLog.objects.create)(
            coach=bot.coach,
            client=client,
            provider=response_provider,
            model=response_model,
            task_type='text',
            input_tokens=second_call_input,
            output_tokens=second_call_output,
            cost_usd=second_cost,
        )

        ai_request_log = {
            'system_prompt': persona.food_response_prompt,
            'messages': [{'role': 'user', 'content': user_message}],
            'provider': provider_name,
            'model': model_name or '',
            'temperature': persona.temperature,
            'max_tokens': persona.max_tokens,
        }
        ai_response_log = {
            'content': response.content,
            'model': response.model or '',
            'usage': response.usage or {},
            'response_id': response.response_id or '',
            'analysis': analysis,
        }
    else:
        # Fallback to template response
        intro = random.choice(ANALYSIS_INTRO_PHRASES)
        response_text = f'{intro}\n\n{format_meal_response(analysis, summary)}'
        duration_ms = duration_ms_analysis
        response_provider = meta.get('provider', '')
        response_model = meta.get('model', '')

        analyze_prompt = ANALYZE_FOOD_PROMPT
        if caption:
            analyze_prompt += f'\n\nПодпись пользователя: "{caption}"'

        ai_request_log = {
            'prompt': analyze_prompt,
            'provider': response_provider,
            'model': response_model,
            'max_tokens': 500,
        }
        ai_response_log = {
            'analysis': analysis,
            'raw_content': meta.get('raw_content', ''),
            'usage': meta.get('usage', {}),
            'response_id': meta.get('response_id', ''),
        }

    await send_message(bot.token, chat_id, response_text)

    # Сохраняем AI комментарий в meal
    if persona.food_response_prompt and response_text:
        meal.ai_comment = response_text
        await sync_to_async(meal.save)(update_fields=['ai_comment'])

    # Log interaction
    await sync_to_async(InteractionLog.objects.create)(
        client=client,
        coach=bot.coach,
        interaction_type='vision',
        client_input=caption or '[Фото еды]',
        ai_request=ai_request_log,
        ai_response=ai_response_log,
        client_output=response_text,
        provider=response_provider,
        model=response_model,
        duration_ms=duration_ms,
    )


async def _handle_data_photo(bot: TelegramBot, client: Client, chat_id: int, image_data: bytes):
    """Parse health metrics from photo (scales, trackers, etc.)."""
    metrics_data = await parse_metrics_from_photo(bot, image_data, client)
    if metrics_data:
        await save_metrics(client, metrics_data)
    response_text = format_metrics_response(metrics_data)
    await send_message(bot.token, chat_id, response_text)


async def _notify_coach_about_meal(bot: TelegramBot, client: Client, analysis: dict, summary: dict):
    """Send notification about meal to coach's report chat."""
    try:
        # Get coach's notification chat ID
        coach = bot.coach
        notification_chat_id = await sync_to_async(lambda: coach.telegram_notification_chat_id)()

        if not notification_chat_id:
            return

        # Format notification message
        client_name = await sync_to_async(lambda: f'{client.first_name} {client.last_name}'.strip() or client.telegram_username or f'Клиент #{client.pk}')()

        dish_name = analysis.get('dish_name', 'Неизвестное блюдо')
        calories = analysis.get('calories')
        proteins = analysis.get('proteins')
        fats = analysis.get('fats')
        carbs = analysis.get('carbohydrates')

        # Build KBJU string
        kbju_parts = []
        if calories:
            kbju_parts.append(f'{int(calories)} ккал')
        if proteins:
            kbju_parts.append(f'Б: {int(proteins)}')
        if fats:
            kbju_parts.append(f'Ж: {int(fats)}')
        if carbs:
            kbju_parts.append(f'У: {int(carbs)}')
        kbju_str = ' | '.join(kbju_parts) if kbju_parts else 'КБЖУ не определено'

        # Daily totals from summary
        daily_calories = summary.get('total_calories', 0)
        daily_target = summary.get('daily_calories', 0)

        message = (
            f'🍽 <b>{client_name}</b>\n\n'
            f'<b>{dish_name}</b>\n'
            f'{kbju_str}\n\n'
        )

        if daily_target:
            progress_pct = int(daily_calories / daily_target * 100) if daily_target else 0
            message += f'📊 За день: {int(daily_calories)} / {int(daily_target)} ккал ({progress_pct}%)'
        else:
            message += f'📊 За день: {int(daily_calories)} ккал'

        result, new_chat_id = await send_notification(bot.token, notification_chat_id, message, parse_mode='HTML')

        # Обновляем chat_id если группа мигрировала в супергруппу
        if new_chat_id:
            coach.telegram_notification_chat_id = str(new_chat_id)
            await sync_to_async(coach.save)(update_fields=['telegram_notification_chat_id'])
            logger.info('[NOTIFY] Updated notification chat_id for coach=%s: %s -> %s',
                       coach.pk, notification_chat_id, new_chat_id)

        if result:
            logger.info('[NOTIFY] Sent meal notification for client=%s to chat=%s', client.pk, notification_chat_id)

    except Exception as e:
        logger.warning('[NOTIFY] Failed to send meal notification: %s', e)
