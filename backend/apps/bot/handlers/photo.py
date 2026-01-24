import logging

from apps.accounts.models import Client
from apps.meals.services import (
    analyze_food,
    classify_image,
    format_meal_response,
    get_daily_summary,
    save_meal,
)
from apps.metrics.services import (
    format_metrics_response,
    parse_metrics_from_photo,
    save_metrics,
)
from apps.persona.models import TelegramBot

from ..telegram_api import get_file, send_chat_action, send_message
from ..services import get_ai_vision_response

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

        # Classify image
        image_type = await classify_image(bot, image_data)

        if image_type == 'food':
            await _handle_food_photo(bot, client, chat_id, image_data, caption)
        elif image_type == 'data':
            await _handle_data_photo(bot, client, chat_id, image_data)
        else:
            # Generic AI vision response for non-food photos
            response_text = await get_ai_vision_response(bot, client, image_data, caption)
            await send_message(bot.token, chat_id, response_text)

    except Exception as e:
        logger.exception('Error handling photo for client %s: %s', client.pk, e)
        await send_message(bot.token, chat_id, 'Произошла ошибка. Попробуйте позже.')


async def _handle_food_photo(bot: TelegramBot, client: Client, chat_id: int, image_data: bytes, caption: str):
    """Analyze food photo, save meal, return nutrition summary."""
    analysis = await analyze_food(bot, image_data, caption)
    await save_meal(client, image_data, analysis)
    summary = await get_daily_summary(client)
    response_text = format_meal_response(analysis, summary)
    await send_message(bot.token, chat_id, response_text)


async def _handle_data_photo(bot: TelegramBot, client: Client, chat_id: int, image_data: bytes):
    """Parse health metrics from photo (scales, trackers, etc.)."""
    metrics_data = await parse_metrics_from_photo(bot, image_data)
    if metrics_data:
        await save_metrics(client, metrics_data)
    response_text = format_metrics_response(metrics_data)
    await send_message(bot.token, chat_id, response_text)
