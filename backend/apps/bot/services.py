import logging
import time
from decimal import Decimal

from asgiref.sync import sync_to_async

from apps.accounts.models import Client
from apps.chat.models import ChatMessage, InteractionLog
from apps.persona.models import AIProviderConfig, AIUsageLog, BotPersona, TelegramBot
from core.ai.factory import get_ai_provider

logger = logging.getLogger(__name__)


def _build_client_context(client: Client) -> str:
    """Build client context string with personal info including gender."""
    parts = []

    # Gender
    if client.gender:
        gender_label = 'мужчина' if client.gender == 'male' else 'женщина'
        parts.append(f'Пол клиента: {gender_label}')

    # Name
    name = f'{client.first_name} {client.last_name}'.strip()
    if name:
        parts.append(f'Имя: {name}')

    # Age from birth_date
    if client.birth_date:
        from datetime import date
        today = date.today()
        age = today.year - client.birth_date.year - (
            (today.month, today.day) < (client.birth_date.month, client.birth_date.day)
        )
        parts.append(f'Возраст: {age} лет')

    # Physical data
    if client.height:
        parts.append(f'Рост: {client.height} см')
    if client.weight:
        parts.append(f'Вес: {client.weight} кг')

    # Daily norms
    if client.daily_calories:
        parts.append(f'Норма калорий: {client.daily_calories} ккал')

    if not parts:
        return ''

    return '\n\n[Данные о клиенте]\n' + '\n'.join(parts)


def _build_system_prompt(persona_prompt: str, client: Client) -> str:
    """Build full system prompt with persona instructions and client context."""
    client_context = _build_client_context(client)

    if client_context:
        # Add client context and instruction to consider gender
        gender_instruction = ''
        if client.gender:
            gender_instruction = (
                '\n\nВАЖНО: При всех ответах учитывай пол клиента. '
                'Используй соответствующие формы обращения и рекомендации, '
                'учитывая физиологические особенности.'
            )
        return persona_prompt + client_context + gender_instruction

    return persona_prompt


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
    from core.ai.model_fetcher import get_cached_pricing

    # Extract tokens with fallback for OpenAI format
    input_tokens = usage.get('input_tokens') or usage.get('prompt_tokens') or 0
    output_tokens = usage.get('output_tokens') or usage.get('completion_tokens') or 0

    # Calculate cost from OpenRouter pricing
    cost_usd = Decimal('0')
    if input_tokens or output_tokens:
        pricing = get_cached_pricing(provider_name, model)
        if pricing:
            price_in, price_out = pricing
            cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))
        else:
            logger.warning(
                '[AI USAGE] No pricing found for provider=%s model=%s, tokens_in=%s tokens_out=%s -> cost=$0',
                provider_name, model, input_tokens, output_tokens
            )

    await sync_to_async(AIUsageLog.objects.create)(
        coach=coach,
        client=client,
        provider=provider_name,
        model=model,
        task_type=task_type,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )


async def get_ai_text_response(bot: TelegramBot, client: Client, text: str) -> str:
    """Main text conversation flow."""
    persona = await _get_persona(bot, client)

    # Save user message
    await _save_message(client, 'user', text, 'text')

    # Load context
    context = await _get_context_messages(client)

    # Build system prompt with client context (including gender)
    system_prompt = _build_system_prompt(persona.system_prompt, client)

    # Get AI provider
    provider_name = persona.text_provider or 'openai'
    model = persona.text_model or None
    api_key = await _get_api_key(bot.coach, provider_name)
    provider = get_ai_provider(provider_name, api_key)

    # Call AI
    start_time = time.time()
    response = await provider.complete(
        messages=context,
        system_prompt=system_prompt,
        max_tokens=persona.max_tokens,
        temperature=persona.temperature,
        model=model,
    )
    duration_ms = int((time.time() - start_time) * 1000)

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

    # Log interaction
    await sync_to_async(InteractionLog.objects.create)(
        client=client,
        coach=bot.coach,
        interaction_type='text',
        client_input=text,
        ai_request={
            'system_prompt': persona.system_prompt,
            'messages': context,
            'provider': provider_name,
            'model': model or '',
            'temperature': persona.temperature,
            'max_tokens': persona.max_tokens,
        },
        ai_response={
            'content': response.content,
            'model': response.model or '',
            'usage': response.usage or {},
            'response_id': response.response_id or '',
        },
        client_output=response.content,
        provider=provider_name,
        model=response.model or model or '',
        duration_ms=duration_ms,
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

    # Build prompt with client context (including gender)
    system_prompt = _build_system_prompt(persona.system_prompt, client)
    prompt = system_prompt + '\n\n'
    if caption:
        prompt += f'Пользователь отправил фото с подписью: "{caption}". Проанализируй изображение.'
    else:
        prompt += 'Пользователь отправил фото. Проанализируй изображение и дай рекомендации.'

    # Call AI vision
    start_time = time.time()
    response = await provider.analyze_image(
        image_data=image_data,
        prompt=prompt,
        max_tokens=persona.max_tokens,
        model=model,
    )
    duration_ms = int((time.time() - start_time) * 1000)

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

    # Log interaction
    await sync_to_async(InteractionLog.objects.create)(
        client=client,
        coach=bot.coach,
        interaction_type='vision',
        client_input=user_text,
        ai_request={
            'system_prompt': persona.system_prompt,
            'prompt': prompt,
            'provider': provider_name,
            'model': model or '',
            'max_tokens': persona.max_tokens,
        },
        ai_response={
            'content': response.content,
            'model': response.model or '',
            'usage': response.usage or {},
            'response_id': response.response_id or '',
        },
        client_output=response.content,
        provider=provider_name,
        model=response.model or model or '',
        duration_ms=duration_ms,
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
