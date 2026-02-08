import base64
import logging

from asgiref.sync import sync_to_async
from django.core.cache import cache

from apps.accounts.models import Client
from apps.persona.models import TelegramBot
from ..telegram_api import answer_callback_query, send_message, send_chat_action

logger = logging.getLogger(__name__)


async def handle_callback_query(bot: TelegramBot, callback_query: dict):
    """Handle Telegram callback_query (inline keyboard button press)."""
    callback_data = callback_query.get('data', '')
    callback_id = callback_query.get('id', '')
    from_user = callback_query.get('from', {})
    message = callback_query.get('message', {})
    chat_id = message.get('chat', {}).get('id')

    if not callback_data or not chat_id:
        return

    # Ack callback to remove loading spinner
    await answer_callback_query(bot.token, callback_id)

    if callback_data.startswith('meal_type:'):
        await _handle_meal_type_callback(bot, from_user, chat_id, callback_data)
    else:
        logger.warning('[CALLBACK] Unknown callback_data: %s', callback_data)


async def _handle_meal_type_callback(bot: TelegramBot, from_user: dict, chat_id: int, callback_data: str):
    """Handle meal type selection from inline keyboard."""
    from .photo import _handle_food_photo_with_analysis

    meal_type = callback_data.split(':', 1)[1]
    telegram_user_id = from_user.get('id')

    if not telegram_user_id:
        return

    # Find client
    client = await sync_to_async(
        lambda: Client.objects.filter(telegram_user_id=telegram_user_id).first()
    )()
    if not client:
        logger.warning('[CALLBACK] Client not found for tg_user=%s', telegram_user_id)
        return

    # Get cached data
    cache_key = f'pending_meal:{client.pk}'
    cached = cache.get(cache_key)
    if not cached:
        await send_message(bot.token, chat_id, 'Время ожидания истекло. Отправьте фото ещё раз.')
        logger.info('[CALLBACK] Cache expired for client=%s', client.pk)
        return

    # Delete from cache immediately to prevent double processing
    cache.delete(cache_key)

    analysis = cached['analysis']
    image_data = base64.b64decode(cached['image_data'])
    caption = cached.get('caption', '')
    total_start = cached.get('total_start')

    await send_chat_action(bot.token, chat_id, 'typing')

    logger.info('[CALLBACK] Meal type selected: client=%s type=%s dish="%s"',
                client.pk, meal_type, analysis.get('dish_name', ''))

    await _handle_food_photo_with_analysis(
        bot, client, chat_id, image_data, caption, analysis,
        total_start=total_start,
        program_meal_type=meal_type,
    )
