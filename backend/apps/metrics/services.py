import json
import logging
from decimal import Decimal

from asgiref.sync import sync_to_async
from django.utils import timezone

from apps.accounts.models import Client
from apps.persona.models import AIProviderConfig, AIUsageLog, BotPersona, TelegramBot
from core.ai.factory import get_ai_provider
from core.ai.model_fetcher import get_cached_pricing

from .models import HealthMetric

logger = logging.getLogger(__name__)

PARSE_METRICS_PROMPT = """Проанализируй фото и извлеки числовые показатели здоровья.
Верни JSON-массив (без markdown-обёртки, только чистый JSON):
[
  {
    "metric_type": "тип (weight|sleep|steps|heart_rate|blood_pressure|water|custom)",
    "value": число,
    "unit": "единица измерения (кг, часы, шаги, уд/мин, мл, и т.д.)",
    "notes": "краткое описание (опционально)"
  }
]

Типы метрик:
- weight — вес (кг)
- sleep — часы сна
- steps — шаги
- heart_rate — пульс (уд/мин)
- blood_pressure — давление (верхнее число)
- water — вода (мл или л)
- custom — любое другое

Если на фото нет данных — верни пустой массив [].
Если на фото давление (например 120/80) — создай одну запись с value=120, notes="120/80".
"""


async def parse_metrics_from_photo(bot: TelegramBot, image_data: bytes, client: Client = None) -> list[dict]:
    """Use AI vision to extract health metrics from a photo."""
    # Use client's persona or coach's default
    persona = None
    if client:
        persona = await sync_to_async(lambda: client.persona)()

    if not persona:
        persona = await sync_to_async(
            lambda: BotPersona.objects.filter(coach=bot.coach).first()
        )()

    if not persona:
        raise ValueError(f'No BotPersona configured for coach {bot.coach_id}')

    provider_name = persona.vision_provider or persona.text_provider or 'openai'
    model = persona.vision_model or persona.text_model or None

    config = await sync_to_async(
        lambda: AIProviderConfig.objects.filter(
            coach=bot.coach, provider=provider_name, is_active=True
        ).first()
    )()
    if not config:
        raise ValueError(f'No API key for provider: {provider_name}')

    provider = get_ai_provider(provider_name, config.api_key)

    response = await provider.analyze_image(
        image_data=image_data,
        prompt=PARSE_METRICS_PROMPT,
        max_tokens=500,
        model=model,
    )

    # Log usage
    usage = response.usage or {}
    input_tokens = usage.get('input_tokens') or usage.get('prompt_tokens') or 0
    output_tokens = usage.get('output_tokens') or usage.get('completion_tokens') or 0

    cost_usd = Decimal('0')
    pricing = get_cached_pricing(provider_name, response.model or model or '')
    if pricing and (input_tokens or output_tokens):
        price_in, price_out = pricing
        cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

    await sync_to_async(AIUsageLog.objects.create)(
        coach=bot.coach,
        provider=provider_name,
        model=response.model or model or '',
        task_type='vision',
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    # Parse JSON
    content = response.content.strip()
    if content.startswith('```'):
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

    try:
        metrics = json.loads(content)
        if not isinstance(metrics, list):
            metrics = []
    except json.JSONDecodeError:
        logger.error('Failed to parse metrics JSON: %s', content)
        metrics = []

    return metrics


async def save_metrics(client: Client, metrics_data: list[dict]) -> list[HealthMetric]:
    """Save parsed metrics to database."""
    now = timezone.now()
    saved = []

    for m in metrics_data:
        metric_type = m.get('metric_type', 'custom')
        value = m.get('value')
        if value is None:
            continue

        try:
            value = float(value)
        except (ValueError, TypeError):
            continue

        metric = await sync_to_async(HealthMetric.objects.create)(
            client=client,
            metric_type=metric_type,
            value=value,
            unit=m.get('unit', ''),
            notes=m.get('notes', ''),
            source='photo',
            recorded_at=now,
        )
        saved.append(metric)

    return saved


def format_metrics_response(metrics: list[dict]) -> str:
    """Format parsed metrics for Telegram response."""
    if not metrics:
        return 'Не удалось распознать данные на фото.'

    lines = ['Записано:']
    for m in metrics:
        metric_type = m.get('metric_type', 'custom')
        value = m.get('value', '')
        unit = m.get('unit', '')
        notes = m.get('notes', '')

        type_names = {
            'weight': 'Вес',
            'sleep': 'Сон',
            'steps': 'Шаги',
            'heart_rate': 'Пульс',
            'blood_pressure': 'Давление',
            'water': 'Вода',
            'custom': 'Другое',
        }
        name = type_names.get(metric_type, metric_type)
        line = f'  {name}: {value} {unit}'
        if notes:
            line += f' ({notes})'
        lines.append(line)

    return '\n'.join(lines)
