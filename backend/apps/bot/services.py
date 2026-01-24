import logging
from decimal import Decimal

from asgiref.sync import sync_to_async

from apps.accounts.models import Client
from apps.chat.models import ChatMessage
from apps.persona.models import AIProviderConfig, AIUsageLog, BotPersona, TelegramBot
from core.ai.factory import get_ai_provider

logger = logging.getLogger(__name__)


async def _get_persona(bot: TelegramBot, client: Client | None = None) -> BotPersona:
    def _resolve():
        # Priority: client.persona → coach default → first coach persona
        if client and client.persona_id:
            return client.persona
        default = BotPersona.objects.filter(coach=bot.coach, is_default=True).first()
        if default:
            return default
        return BotPersona.objects.filter(coach=bot.coach).first()
    persona = await sync_to_async(_resolve)()
    if not persona:
        raise BotPersona.DoesNotExist('No persona configured for coach')
    return persona


async def _get_api_key(coach, provider_name: str) -> str:
    config = await sync_to_async(
        lambda: AIProviderConfig.objects.filter(
            coach=coach, provider=provider_name, is_active=True
        ).first()
    )()
    if not config:
        raise ValueError(f'No API key configured for provider: {provider_name}')
    return config.api_key


async def _save_message(client: Client, role: str, content: str, message_type: str = 'text', **kwargs) -> ChatMessage:
    return await sync_to_async(ChatMessage.objects.create)(
        client=client,
        role=role,
        content=content,
        message_type=message_type,
        **kwargs,
    )


async def _get_context_messages(client: Client, limit: int = 20) -> list[dict]:
    messages = await sync_to_async(
        lambda: list(
            ChatMessage.objects.filter(client=client)
            .order_by('-created_at')[:limit]
        )
    )()
    messages.reverse()
    return [{'role': msg.role, 'content': msg.content} for msg in messages]


async def _log_usage(coach, client, provider_name: str, model: str, task_type: str, usage: dict):
    await sync_to_async(AIUsageLog.objects.create)(
        coach=coach,
        client=client,
        provider=provider_name,
        model=model,
        task_type=task_type,
        input_tokens=usage.get('input_tokens', 0),
        output_tokens=usage.get('output_tokens', 0),
        cost_usd=Decimal('0'),
    )


async def get_ai_text_response(bot: TelegramBot, client: Client, text: str) -> str:
    """Main text conversation flow."""
    persona = await _get_persona(bot, client)

    # Save user message
    await _save_message(client, 'user', text, 'text')

    # Load context
    context = await _get_context_messages(client)

    # Get AI provider
    provider_name = persona.text_provider or 'openai'
    model = persona.text_model or None
    api_key = await _get_api_key(bot.coach, provider_name)
    provider = get_ai_provider(provider_name, api_key)

    # Call AI
    response = await provider.complete(
        messages=context,
        system_prompt=persona.system_prompt,
        max_tokens=persona.max_tokens,
        temperature=persona.temperature,
        model=model,
    )

    # Save assistant response
    await _save_message(
        client, 'assistant', response.content, 'text',
        ai_response_id=response.response_id or '',
        ai_provider=provider_name,
    )

    # Log usage
    await _log_usage(
        bot.coach, client, provider_name,
        response.model or model or '', 'text', response.usage,
    )

    return response.content


async def get_ai_vision_response(bot: TelegramBot, client: Client, image_data: bytes, caption: str = '') -> str:
    """Photo analysis flow."""
    persona = await _get_persona(bot, client)

    # Save user message
    user_text = caption or '[Фото]'
    await _save_message(client, 'user', user_text, 'photo')

    # Get vision provider
    provider_name = persona.vision_provider or persona.text_provider or 'openai'
    model = persona.vision_model or persona.text_model or None
    api_key = await _get_api_key(bot.coach, provider_name)
    provider = get_ai_provider(provider_name, api_key)

    # Build prompt
    prompt = persona.system_prompt + '\n\n'
    if caption:
        prompt += f'Пользователь отправил фото с подписью: "{caption}". Проанализируй изображение.'
    else:
        prompt += 'Пользователь отправил фото. Проанализируй изображение и дай рекомендации.'

    # Call AI vision
    response = await provider.analyze_image(
        image_data=image_data,
        prompt=prompt,
        max_tokens=persona.max_tokens,
        model=model,
    )

    # Save assistant response
    await _save_message(
        client, 'assistant', response.content, 'text',
        ai_response_id=response.response_id or '',
        ai_provider=provider_name,
    )

    # Log usage
    await _log_usage(
        bot.coach, client, provider_name,
        response.model or model or '', 'vision', response.usage,
    )

    return response.content


async def transcribe_audio(bot: TelegramBot, audio_data: bytes) -> str:
    """Transcribe audio to text. Uses voice_provider or falls back to openai."""
    persona = await _get_persona(bot)

    # Determine transcription provider - fallback to openai for providers that can't transcribe
    provider_name = persona.voice_provider or 'openai'
    if provider_name in ('anthropic', 'deepseek'):
        provider_name = 'openai'

    api_key = await _get_api_key(bot.coach, provider_name)
    provider = get_ai_provider(provider_name, api_key)

    text = await provider.transcribe_audio(audio_data, language='ru')

    # Log usage
    await _log_usage(
        bot.coach, None, provider_name,
        'whisper-1' if provider_name == 'openai' else '', 'voice', {},
    )

    return text
