import json
import logging
import time

from asgiref.sync import sync_to_async

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

from ..telegram_api import get_file, send_chat_action, send_message
from ..services import get_ai_vision_response, _get_persona, _get_api_key

logger = logging.getLogger(__name__)


async def handle_photo(bot: TelegramBot, client: Client, message: dict):
    """Handle incoming photo message with classification."""
    chat_id = message['chat']['id']

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
        await send_message(bot.token, chat_id, '📸 Фото получил, анализирую...')

        # Classify and analyze in one call
        result = await classify_and_analyze(bot, image_data, caption)
        image_type = result.get('type', 'other')

        if image_type == 'food':
            # Already have analysis from classify_and_analyze
            await _handle_food_photo_with_analysis(bot, client, chat_id, image_data, caption, result)
        elif image_type == 'data':
            await _handle_data_photo(bot, client, chat_id, image_data)
        else:
            # Generic AI vision response for non-food photos
            response_text = await get_ai_vision_response(bot, client, image_data, caption)
            await send_message(bot.token, chat_id, response_text)

    except Exception as e:
        logger.exception('Error handling photo for client %s: %s', client.pk, e)
        await send_message(bot.token, chat_id, 'Произошла ошибка. Попробуйте позже.')


async def _handle_food_photo_with_analysis(bot: TelegramBot, client: Client, chat_id: int, image_data: bytes, caption: str, analysis: dict):
    """Handle food photo with pre-computed analysis from classify_and_analyze."""
    from core.ai.factory import get_ai_provider

    start_time = time.time()

    # Extract meta before saving
    meta = analysis.pop('_meta', {})

    await save_meal(client, image_data, analysis)
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

        response = await provider.complete(
            messages=[{'role': 'user', 'content': user_message}],
            system_prompt=persona.food_response_prompt,
            max_tokens=persona.max_tokens,
            temperature=persona.temperature,
            model=model_name,
        )
        duration_ms = int((time.time() - start_time) * 1000)
        response_text = response.content
        response_model = response.model or model_name or ''
        response_provider = provider_name

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
        response_text = format_meal_response(analysis, summary)
        duration_ms = int((time.time() - start_time) * 1000)
        response_provider = meta.get('provider', '')
        response_model = meta.get('model', '')

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


async def _handle_food_photo(bot: TelegramBot, client: Client, chat_id: int, image_data: bytes, caption: str):
    """Analyze food photo, save meal, return nutrition summary."""
    from core.ai.factory import get_ai_provider

    start_time = time.time()
    analysis = await analyze_food(bot, image_data, caption)
    duration_ms_analysis = int((time.time() - start_time) * 1000)

    # Extract meta before saving
    meta = analysis.pop('_meta', {})

    await save_meal(client, image_data, analysis)
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

        start_response = time.time()
        response = await provider.complete(
            messages=[{'role': 'user', 'content': user_message}],
            system_prompt=persona.food_response_prompt,
            max_tokens=persona.max_tokens,
            temperature=persona.temperature,
            model=model_name,
        )
        duration_ms = duration_ms_analysis + int((time.time() - start_response) * 1000)
        response_text = response.content
        response_model = response.model or model_name or ''
        response_provider = provider_name

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
        response_text = format_meal_response(analysis, summary)
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
    metrics_data = await parse_metrics_from_photo(bot, image_data)
    if metrics_data:
        await save_metrics(client, metrics_data)
    response_text = format_metrics_response(metrics_data)
    await send_message(bot.token, chat_id, response_text)
