import logging

from apps.accounts.models import Client
from apps.onboarding.services import process_answer
from apps.persona.models import TelegramBot

from ..telegram_api import send_message

logger = logging.getLogger(__name__)

ONBOARDING_COMPLETE_TEXT = (
    'Отлично! Анкета заполнена.\n'
    'Ваши персональные нормы рассчитаны.\n\n'
    'Теперь вы можете отправлять мне фото еды для анализа, '
    'задавать вопросы или отправлять голосовые сообщения.'
)


async def handle_onboarding(bot: TelegramBot, client: Client, message: dict):
    """Handle text message during onboarding — process as answer to current question."""
    chat_id = message['chat']['id']
    text = message.get('text', '').strip()

    if not text:
        return

    try:
        result = await process_answer(client, text)

        if result['completed']:
            await send_message(bot.token, chat_id, ONBOARDING_COMPLETE_TEXT)
        elif result['next_question']:
            await send_message(bot.token, chat_id, result['next_question'])
    except Exception as e:
        logger.exception('Error handling onboarding for client %s: %s', client.pk, e)
        await send_message(bot.token, chat_id, 'Произошла ошибка. Попробуйте ещё раз.')
