import json
import logging
import time

from asgiref.sync import sync_to_async

from apps.accounts.models import Client
from apps.chat.models import InteractionLog
from apps.meals.services import (
    get_recent_meal,
    is_meal_correction,
    recalculate_meal,
    get_daily_summary,
    format_meal_response,
)
from apps.persona.models import TelegramBot

from ..telegram_api import send_chat_action, send_message
from ..services import get_ai_text_response, _get_persona, _get_api_key

logger = logging.getLogger(__name__)


async def handle_text(bot: TelegramBot, client: Client, message: dict):
    """Handle incoming text message."""
    chat_id = message['chat']['id']
    text = message.get('text', '')

    if not text:
        return

    await send_chat_action(bot.token, chat_id)

    try:
        # Check for meal correction
        recent_meal = await get_recent_meal(client)
        if recent_meal:
            is_correction = await is_meal_correction(bot, recent_meal, text)
            if is_correction:
                await _handle_meal_correction(bot, client, chat_id, recent_meal, text)
                return

        response_text = await get_ai_text_response(bot, client, text)
        await send_message(bot.token, chat_id, response_text)
    except Exception as e:
        logger.exception('Error handling text message for client %s: %s', client.pk, e)
        await send_message(bot.token, chat_id, 'Произошла ошибка. Попробуйте позже.')


async def _handle_meal_correction(bot: TelegramBot, client: Client, chat_id: int, meal, user_text: str):
    """Handle meal correction: recalculate and send updated response."""
    from core.ai.factory import get_ai_provider

    start_time = time.time()
    updated = await recalculate_meal(bot, meal, user_text)
    duration_ms = int((time.time() - start_time) * 1000)

    if not updated:
        await send_message(bot.token, chat_id, 'Не удалось пересчитать. Попробуйте описать точнее.')
        return

    summary = await get_daily_summary(client)
    persona = await _get_persona(bot, client)

    if persona.food_response_prompt:
        provider_name = persona.text_provider or 'openai'
        model_name = persona.text_model or None
        api_key = await _get_api_key(bot.coach, provider_name)
        provider = get_ai_provider(provider_name, api_key)

        user_message = (
            f'Пользователь уточнил предыдущий приём пищи: "{user_text}"\n\n'
            f'Обновлённые данные:\n'
            f'{json.dumps(updated, ensure_ascii=False)}\n\n'
            f'Дневная сводка:\n'
            f'{json.dumps(summary, ensure_ascii=False)}'
        )

        correction_addendum = (
            '\n\nВАЖНО: Это ответ на уточнение пользователя. Ты ранее неточно определил блюдо или порцию. '
            'Ответь так, будто ты сам заметил неточность и рад уточнению — '
            'естественно прими поправку, покажи обновлённые данные. '
            'Не извиняйся формально, но покажи что принял информацию к сведению.'
        )

        start_response = time.time()
        response = await provider.complete(
            messages=[{'role': 'user', 'content': user_message}],
            system_prompt=persona.food_response_prompt + correction_addendum,
            max_tokens=persona.max_tokens,
            temperature=persona.temperature,
            model=model_name,
        )
        duration_ms += int((time.time() - start_response) * 1000)
        response_text = response.content
    else:
        response_text = f'Обновлено: {format_meal_response(updated, summary)}'

    await send_message(bot.token, chat_id, response_text)

    # Log interaction
    await sync_to_async(InteractionLog.objects.create)(
        client=client,
        coach=bot.coach,
        interaction_type='text',
        client_input=user_text,
        ai_request={
            'type': 'meal_correction',
            'original_meal': meal.dish_name,
            'correction': user_text,
        },
        ai_response={
            'updated': updated,
        },
        client_output=response_text,
        provider=persona.text_provider or '',
        model=persona.text_model or '',
        duration_ms=duration_ms,
    )
