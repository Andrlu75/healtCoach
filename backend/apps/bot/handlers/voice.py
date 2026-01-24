import logging

from apps.accounts.models import Client
from apps.persona.models import TelegramBot

from ..telegram_api import get_file, send_chat_action, send_message
from ..services import get_ai_text_response, transcribe_audio

logger = logging.getLogger(__name__)


async def handle_voice(bot: TelegramBot, client: Client, message: dict):
    """Handle incoming voice or audio message."""
    chat_id = message['chat']['id']

    # Get file_id from voice or audio
    voice = message.get('voice') or message.get('audio')
    if not voice:
        return

    file_id = voice['file_id']

    await send_chat_action(bot.token, chat_id)

    try:
        # Download audio
        audio_data = await get_file(bot.token, file_id)
        if not audio_data:
            await send_message(bot.token, chat_id, 'Не удалось загрузить аудио.')
            return

        # Transcribe
        text = await transcribe_audio(bot, audio_data)
        if not text:
            await send_message(bot.token, chat_id, 'Не удалось распознать речь.')
            return

        # Get AI response using transcribed text
        response_text = await get_ai_text_response(bot, client, text)
        await send_message(bot.token, chat_id, response_text)
    except Exception as e:
        logger.exception('Error handling voice message for client %s: %s', client.pk, e)
        await send_message(bot.token, chat_id, 'Произошла ошибка. Попробуйте позже.')
