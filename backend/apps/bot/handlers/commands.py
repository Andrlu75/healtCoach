import logging

from asgiref.sync import sync_to_async
from django.conf import settings

from apps.accounts.models import Client
from apps.onboarding.services import (
    format_question,
    get_current_question,
    start_onboarding,
    use_invite,
    validate_invite,
)
from apps.persona.models import TelegramBot

from ..services import _get_persona
from ..telegram_api import send_message, send_message_with_webapp

logger = logging.getLogger(__name__)


async def handle_start(bot: TelegramBot, client: Client, message: dict):
    """Handle /start command with optional invite code."""
    chat_id = message['chat']['id']
    text = message.get('text', '')

    # Extract invite code from /start invite_CODE
    parts = text.split(maxsplit=1)
    invite_code = parts[1].strip() if len(parts) > 1 else ''

    try:
        if invite_code:
            await _handle_invite_start(bot, client, chat_id, invite_code)
        else:
            await _handle_regular_start(bot, client, chat_id)
    except Exception as e:
        logger.exception('Error handling /start for client %s: %s', client.pk, e)
        await send_message(bot.token, chat_id, 'Привет! Чем могу помочь?')


async def _handle_invite_start(bot: TelegramBot, client: Client, chat_id: int, code: str):
    """Handle /start with invite code — redirect to miniapp for onboarding."""
    invite = await validate_invite(code)

    if not invite:
        await send_message(bot.token, chat_id, 'Ссылка недействительна или истекла.')
        return

    # Use invite
    await use_invite(invite)

    # Link client to coach and save invite code for miniapp
    client.coach = invite.coach
    client.onboarding_data = {
        'started': False,
        'invite_code': code,
        'answers': {},
    }
    client.onboarding_completed = False
    await sync_to_async(client.save)(
        update_fields=['coach', 'onboarding_data', 'onboarding_completed']
    )

    # Get persona for greeting
    persona = await _get_persona(bot, client)

    greeting = ''
    if persona and persona.greeting_message:
        greeting = persona.greeting_message + '\n\n'

    # Check if miniapp is configured
    miniapp_url = settings.TELEGRAM_MINIAPP_URL
    if miniapp_url:
        # Send button to open miniapp for onboarding
        text = (
            f'{greeting}'
            'Добро пожаловать! 🎉\n\n'
            'Нажмите кнопку ниже, чтобы открыть приложение и пройти быструю регистрацию.'
        )
        await send_message_with_webapp(
            bot.token,
            chat_id,
            text,
            button_text='📱 Открыть приложение',
            webapp_url=miniapp_url,
        )
    else:
        # Fallback: start onboarding in bot
        await start_onboarding(client, invite.coach)
        question = await get_current_question(client)
        if question:
            text = greeting + 'Для начала ответьте на несколько вопросов:\n\n' + format_question(question)
        else:
            text = greeting + 'Добро пожаловать!'
        await send_message(bot.token, chat_id, text)


async def _handle_regular_start(bot: TelegramBot, client: Client, chat_id: int):
    """Handle regular /start — send greeting with miniapp button."""
    persona = await _get_persona(bot, client)

    if persona and persona.greeting_message:
        greeting = persona.greeting_message
    else:
        greeting = 'Привет! Я ваш персональный помощник. Чем могу помочь?'

    miniapp_url = settings.TELEGRAM_MINIAPP_URL
    if miniapp_url:
        await send_message_with_webapp(
            bot.token,
            chat_id,
            greeting,
            button_text='📊 Открыть дневник',
            webapp_url=miniapp_url,
        )
    else:
        await send_message(bot.token, chat_id, greeting)
