import json
import logging
import re
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

# Утвердительные ответы для подтверждения запоминания
_AFFIRMATIVE_ANSWERS = frozenset({
    'да', 'ок', 'окей', 'конечно', 'давай', 'запомни',
    'yes', 'ага', 'угу', 'хорошо', 'запоминай', 'сохрани',
    'ладно', 'точно', 'верно',
})


async def handle_text(bot: TelegramBot, client: Client, message: dict):
    """Handle incoming text message."""
    chat_id = message['chat']['id']
    text = message.get('text', '')

    if not text:
        return

    await send_chat_action(bot.token, chat_id)

    try:
        # Проверяем pending memory (ожидание подтверждения запоминания)
        if client.pending_memory:
            pending = client.pending_memory
            affirmative = text.strip().lower() in _AFFIRMATIVE_ANSWERS
            client.pending_memory = ''
            if affirmative:
                memory = list(client.memory or [])
                memory.append(pending)
                client.memory = memory
                await sync_to_async(client.save)(update_fields=['pending_memory', 'memory'])
                await send_message(bot.token, chat_id, f'Запомнил: «{pending}»')
                return
            else:
                await sync_to_async(client.save)(update_fields=['pending_memory'])
                # Не подтвердил — обрабатываем как обычное сообщение

        # Check for meal correction
        recent_meal = await get_recent_meal(client)
        if recent_meal:
            is_correction = await is_meal_correction(bot, recent_meal, text)
            if is_correction:
                await _handle_meal_correction(bot, client, chat_id, recent_meal, text)
                return

        response_text = await get_ai_text_response(bot, client, text)

        # Обработка тегов памяти из ответа AI
        response_text = await _process_memory_tags(client, response_text)

        await send_message(bot.token, chat_id, response_text)
    except Exception as e:
        logger.exception('Error handling text message for client %s: %s', client.pk, e)
        await send_message(bot.token, chat_id, 'Произошла ошибка. Попробуйте позже.')


async def _process_memory_tags(client: Client, response_text: str) -> str:
    """Парсит теги MEMORY_SAVE / MEMORY_DELETE из ответа AI и обрабатывает."""
    memory_save = re.search(r'\[MEMORY_SAVE:\s*(.+?)\]', response_text)
    memory_delete = re.search(r'\[MEMORY_DELETE:\s*(.+?)\]', response_text)

    if memory_save:
        fact = memory_save.group(1).strip()
        client.pending_memory = fact
        await sync_to_async(client.save)(update_fields=['pending_memory'])
        response_text = re.sub(r'\[MEMORY_SAVE:\s*.+?\]', '', response_text).strip()
        logger.info('[MEMORY] Pending save for client %s: %s', client.pk, fact)

    if memory_delete:
        target = memory_delete.group(1).strip()
        memory = list(client.memory or [])
        deleted = False
        for i, item in enumerate(memory):
            if target.lower() in item.lower() or item.lower() in target.lower():
                removed = memory.pop(i)
                deleted = True
                logger.info('[MEMORY] Deleted for client %s: %s', client.pk, removed)
                break
        if deleted:
            client.memory = memory
            await sync_to_async(client.save)(update_fields=['memory'])
        response_text = re.sub(r'\[MEMORY_DELETE:\s*.+?\]', '', response_text).strip()

    return response_text


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

        # Log usage
        from ..services import _log_usage
        await _log_usage(
            bot.coach, client, provider_name,
            response.model or model_name or '', 'text', response.usage or {},
        )
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
