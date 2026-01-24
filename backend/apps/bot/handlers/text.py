import logging

from apps.accounts.models import Client
from apps.persona.models import TelegramBot

from ..telegram_api import send_chat_action, send_message
from ..services import get_ai_text_response

logger = logging.getLogger(__name__)


async def handle_text(bot: TelegramBot, client: Client, message: dict):
    """Handle incoming text message."""
    chat_id = message['chat']['id']
    text = message.get('text', '')

    if not text:
        return

    await send_chat_action(bot.token, chat_id)

    try:
        response_text = await get_ai_text_response(bot, client, text)
        await send_message(bot.token, chat_id, response_text)
    except Exception as e:
        logger.exception('Error handling text message for client %s: %s', client.pk, e)
        await send_message(bot.token, chat_id, 'Произошла ошибка. Попробуйте позже.')
