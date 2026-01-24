import hmac
import json
import logging

from asgiref.sync import sync_to_async
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.accounts.models import Client
from apps.persona.models import TelegramBot

from .handlers.commands import handle_start
from .handlers.onboarding import handle_onboarding
from .handlers.photo import handle_photo
from .handlers.text import handle_text
from .handlers.voice import handle_voice
from .telegram_api import send_message

logger = logging.getLogger(__name__)


@csrf_exempt
async def telegram_webhook(request, bot_id: int):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    # Validate secret token
    secret = getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', '')
    if secret:
        token = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
        if not hmac.compare_digest(token, secret):
            return JsonResponse({'error': 'Unauthorized'}, status=403)

    # Parse body
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    # Always return 200 to prevent Telegram retries
    # Process in try/except to never crash
    try:
        await _dispatch(bot_id, data)
    except Exception as e:
        logger.exception('Webhook error for bot_id=%s: %s', bot_id, e)

    return JsonResponse({'ok': True})


async def _dispatch(bot_id: int, data: dict):
    """Route the update to the appropriate handler."""
    message = data.get('message')
    if not message:
        return

    # Log incoming message
    from_user = message.get('from', {})
    user_name = from_user.get('first_name', '') or from_user.get('username', '')
    user_id = from_user.get('id', '?')

    if message.get('photo'):
        logger.info('[BOT %s] 📷 Фото от %s (id=%s)', bot_id, user_name, user_id)
    elif message.get('voice') or message.get('audio'):
        logger.info('[BOT %s] 🎤 Голосовое от %s (id=%s)', bot_id, user_name, user_id)
    elif message.get('text'):
        text_preview = message['text'][:50] + '...' if len(message.get('text', '')) > 50 else message.get('text', '')
        logger.info('[BOT %s] 💬 Сообщение от %s (id=%s): %s', bot_id, user_name, user_id, text_preview)

    # Load bot
    bot = await sync_to_async(
        lambda: TelegramBot.objects.select_related('coach').filter(
            pk=bot_id, is_active=True
        ).first()
    )()
    if not bot:
        logger.warning('No active bot found for bot_id=%s', bot_id)
        return

    # Identify client
    from_user = message.get('from', {})
    telegram_user_id = from_user.get('id')
    if not telegram_user_id:
        return

    client = await _get_or_create_client(bot, from_user)

    # Route to handler
    text = message.get('text', '')
    chat_id = message['chat']['id']

    if text.startswith('/start'):
        await handle_start(bot, client, message)
    elif _is_onboarding(client):
        if text:
            await handle_onboarding(bot, client, message)
    elif not client.onboarding_completed:
        # Client hasn't completed onboarding — prompt to use invite link
        await send_message(
            bot.token, chat_id,
            'Для начала работы нужна ссылка-приглашение от вашего коуча. '
            'Попросите ссылку и нажмите на неё для регистрации.'
        )
    elif message.get('photo'):
        await handle_photo(bot, client, message)
    elif client.manual_mode:
        # Ручной режим: сохраняем сообщение, AI не отвечает
        from apps.chat.models import ChatMessage
        content = text
        if message.get('voice') or message.get('audio'):
            content = '[голосовое сообщение]'
        if content:
            await sync_to_async(ChatMessage.objects.create)(
                client=client,
                role='user',
                message_type='voice' if (message.get('voice') or message.get('audio')) else 'text',
                content=content,
            )
    elif message.get('voice') or message.get('audio'):
        await handle_voice(bot, client, message)
    elif text:
        await handle_text(bot, client, message)


def _is_onboarding(client: Client) -> bool:
    """Check if client is in the middle of onboarding."""
    if client.onboarding_completed:
        return False
    data = client.onboarding_data
    return bool(data and data.get('started'))


async def _get_or_create_client(bot: TelegramBot, from_user: dict) -> Client:
    """Get or create a client from Telegram user data."""
    telegram_user_id = from_user['id']

    client, created = await sync_to_async(Client.objects.get_or_create)(
        telegram_user_id=telegram_user_id,
        defaults={
            'coach': bot.coach,
            'first_name': from_user.get('first_name', ''),
            'last_name': from_user.get('last_name', ''),
            'telegram_username': from_user.get('username', ''),
            'status': 'pending',
        },
    )

    if created:
        logger.info('New client created: %s (tg_id=%s)', client, telegram_user_id)

    return client
