import json
import logging
from datetime import date, datetime, time
from io import BytesIO

from asgiref.sync import sync_to_async
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.accounts.models import Client
from apps.persona.models import AIProviderConfig, AIUsageLog, BotPersona, TelegramBot
from core.ai.factory import get_ai_provider

from .models import Meal

logger = logging.getLogger(__name__)

MEAL_CORRECTION_WINDOW_MINUTES = 5

CLASSIFY_CORRECTION_PROMPT = """Пользователь ранее отправил фото еды, которое было распознано как: "{dish_name}" ({calories} ккал, Б:{proteins} Ж:{fats} У:{carbs}).

Теперь пользователь написал: "{user_text}"

Это уточнение/коррекция к предыдущему блюду (название, порция, вес, ингредиенты)? Ответь ОДНИМ словом: YES или NO."""

RECALCULATE_PROMPT = """Пользователь уточнил информацию о блюде.

Предыдущее распознавание:
- Блюдо: {dish_name}
- Калории: {calories}, Белки: {proteins}, Жиры: {fats}, Углеводы: {carbs}

Уточнение пользователя: "{user_text}"

Пересчитай КБЖУ с учётом уточнения. Верни JSON (без markdown-обёртки, только чистый JSON):
{{
  "dish_name": "уточнённое название",
  "dish_type": "тип (завтрак/обед/ужин/перекус)",
  "calories": число_ккал,
  "proteins": граммы_белка,
  "fats": граммы_жиров,
  "carbohydrates": граммы_углеводов
}}
"""

CLASSIFY_PROMPT = """Определи тип изображения. Ответь ОДНИМ словом:
- food — если на фото еда, блюдо, напиток, продукты
- data — если на фото цифровые данные (весы, анализы, показатели здоровья, скриншот трекера)
- other — всё остальное

Ответ (одно слово):"""

ANALYZE_FOOD_PROMPT = """Проанализируй фото еды и верни JSON (без markdown-обёртки, только чистый JSON):
{
  "dish_name": "название блюда",
  "dish_type": "тип (завтрак/обед/ужин/перекус)",
  "calories": число_ккал,
  "proteins": граммы_белка,
  "fats": граммы_жиров,
  "carbohydrates": граммы_углеводов,
  "ingredients": ["ингредиент1", "ингредиент2"],
  "confidence": число_от_1_до_100
}

Оценивай порцию по визуальному размеру. Если не уверен — дай приблизительные значения.
"""


async def _get_vision_provider(bot: TelegramBot):
    """Get vision AI provider for the bot's coach."""
    persona = await sync_to_async(
        lambda: BotPersona.objects.get(coach=bot.coach)
    )()

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
    return provider, provider_name, model, persona


async def classify_image(bot: TelegramBot, image_data: bytes) -> str:
    """Classify image as food/data/other using AI vision."""
    provider, provider_name, model, persona = await _get_vision_provider(bot)

    response = await provider.analyze_image(
        image_data=image_data,
        prompt=CLASSIFY_PROMPT,
        max_tokens=10,
        model=model,
    )

    result = response.content.strip().lower()

    # Normalize response
    if 'food' in result:
        return 'food'
    elif 'data' in result:
        return 'data'
    return 'other'


async def analyze_food(bot: TelegramBot, image_data: bytes, caption: str = '') -> dict:
    """Analyze food photo and return structured nutrition data.

    Returns dict with keys: analysis data + _meta with provider info.
    """
    provider, provider_name, model, persona = await _get_vision_provider(bot)

    prompt = ANALYZE_FOOD_PROMPT
    if caption:
        prompt += f'\n\nПодпись пользователя: "{caption}"'

    response = await provider.analyze_image(
        image_data=image_data,
        prompt=prompt,
        max_tokens=500,
        model=model,
    )

    # Log usage
    await sync_to_async(AIUsageLog.objects.create)(
        coach=bot.coach,
        provider=provider_name,
        model=response.model or model or '',
        task_type='vision',
        input_tokens=response.usage.get('input_tokens', 0),
        output_tokens=response.usage.get('output_tokens', 0),
    )

    # Parse JSON from response
    content = response.content.strip()
    # Strip markdown code block if present
    if content.startswith('```'):
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.error('Failed to parse food analysis JSON: %s', content)
        data = {
            'dish_name': 'Неизвестное блюдо',
            'calories': 0,
            'proteins': 0,
            'fats': 0,
            'carbohydrates': 0,
        }

    data['_meta'] = {
        'provider': provider_name,
        'model': response.model or model or '',
        'usage': response.usage or {},
        'response_id': response.response_id or '',
        'raw_content': response.content,
    }

    return data


async def save_meal(client: Client, image_data: bytes, analysis: dict) -> Meal:
    """Save analyzed meal to database with image."""
    now = timezone.now()

    meal = await sync_to_async(Meal.objects.create)(
        client=client,
        image_type='food',
        dish_name=analysis.get('dish_name', 'Неизвестное блюдо'),
        dish_type=analysis.get('dish_type', ''),
        calories=analysis.get('calories'),
        proteins=analysis.get('proteins'),
        fats=analysis.get('fats'),
        carbohydrates=analysis.get('carbohydrates'),
        ingredients=analysis.get('ingredients', []),
        ai_confidence=analysis.get('confidence'),
        meal_time=now,
    )

    # Save image
    if image_data:
        filename = f'meal_{meal.pk}_{now.strftime("%Y%m%d_%H%M%S")}.jpg'
        await sync_to_async(meal.image.save)(filename, ContentFile(image_data), save=True)

    return meal


async def get_daily_summary(client: Client, target_date: date = None) -> dict:
    """Calculate daily nutrition summary: consumed vs remaining."""
    if target_date is None:
        target_date = timezone.localdate()

    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)

    # Make timezone-aware
    tz = timezone.get_current_timezone()
    day_start = timezone.make_aware(day_start, tz)
    day_end = timezone.make_aware(day_end, tz)

    meals = await sync_to_async(
        lambda: list(
            Meal.objects.filter(
                client=client,
                image_type='food',
                meal_time__range=(day_start, day_end),
            )
        )
    )()

    consumed = {
        'calories': sum(m.calories or 0 for m in meals),
        'proteins': sum(m.proteins or 0 for m in meals),
        'fats': sum(m.fats or 0 for m in meals),
        'carbohydrates': sum(m.carbohydrates or 0 for m in meals),
        'meals_count': len(meals),
    }

    # Get client norms
    client_obj = await sync_to_async(
        lambda: Client.objects.get(pk=client.pk)
    )()

    norms = {
        'calories': client_obj.daily_calories or 2000,
        'proteins': client_obj.daily_proteins or 80,
        'fats': client_obj.daily_fats or 70,
        'carbohydrates': client_obj.daily_carbs or 250,
    }

    remaining = {
        'calories': round(norms['calories'] - consumed['calories'], 1),
        'proteins': round(norms['proteins'] - consumed['proteins'], 1),
        'fats': round(norms['fats'] - consumed['fats'], 1),
        'carbohydrates': round(norms['carbohydrates'] - consumed['carbohydrates'], 1),
    }

    return {
        'date': target_date.isoformat(),
        'consumed': consumed,
        'norms': norms,
        'remaining': remaining,
    }


def format_meal_response(analysis: dict, summary: dict) -> str:
    """Format meal analysis + daily summary for Telegram response."""
    name = analysis.get('dish_name', 'Блюдо')
    cal = analysis.get('calories', 0)
    prot = analysis.get('proteins', 0)
    fat = analysis.get('fats', 0)
    carb = analysis.get('carbohydrates', 0)

    remaining = summary.get('remaining', {})
    r_cal = remaining.get('calories', 0)
    r_prot = remaining.get('proteins', 0)
    r_fat = remaining.get('fats', 0)
    r_carb = remaining.get('carbohydrates', 0)

    meals_count = summary.get('consumed', {}).get('meals_count', 0)

    text = (
        f'*{name}*\n'
        f'Ккал: {cal} | Б: {prot} | Ж: {fat} | У: {carb}\n'
        f'\n'
        f'Приём пищи #{meals_count} за сегодня\n'
        f'Остаток на день:\n'
        f'Ккал: {r_cal} | Б: {r_prot} | Ж: {r_fat} | У: {r_carb}'
    )

    return text


async def get_recent_meal(client: Client) -> Meal | None:
    """Get client's most recent meal within correction window."""
    from django.utils import timezone as tz
    import datetime

    cutoff = tz.now() - datetime.timedelta(minutes=MEAL_CORRECTION_WINDOW_MINUTES)
    meal = await sync_to_async(
        lambda: Meal.objects.filter(
            client=client,
            image_type='food',
            created_at__gte=cutoff,
        ).first()
    )()
    return meal


async def is_meal_correction(bot: TelegramBot, meal: Meal, user_text: str) -> bool:
    """Ask AI if user's text is a correction to the recent meal."""
    provider, provider_name, model, persona = await _get_vision_provider(bot)

    prompt = CLASSIFY_CORRECTION_PROMPT.format(
        dish_name=meal.dish_name,
        calories=meal.calories or 0,
        proteins=meal.proteins or 0,
        fats=meal.fats or 0,
        carbs=meal.carbohydrates or 0,
        user_text=user_text,
    )

    response = await provider.complete(
        messages=[{'role': 'user', 'content': prompt}],
        system_prompt='Ответь ОДНИМ словом: YES или NO.',
        max_tokens=5,
        temperature=0,
        model=model,
    )

    return 'yes' in response.content.strip().lower()


async def recalculate_meal(bot: TelegramBot, meal: Meal, user_text: str) -> dict:
    """Recalculate meal nutrition based on user correction."""
    provider, provider_name, model, persona = await _get_vision_provider(bot)

    prompt = RECALCULATE_PROMPT.format(
        dish_name=meal.dish_name,
        calories=meal.calories or 0,
        proteins=meal.proteins or 0,
        fats=meal.fats or 0,
        carbs=meal.carbohydrates or 0,
        user_text=user_text,
    )

    response = await provider.complete(
        messages=[{'role': 'user', 'content': prompt}],
        system_prompt='Верни только JSON.',
        max_tokens=200,
        temperature=0.2,
        model=model,
    )

    # Parse JSON
    content = response.content.strip()
    if content.startswith('```'):
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.error('Failed to parse recalculation JSON: %s', content)
        return {}

    # Update meal
    meal.dish_name = data.get('dish_name', meal.dish_name)
    meal.dish_type = data.get('dish_type', meal.dish_type)
    meal.calories = data.get('calories', meal.calories)
    meal.proteins = data.get('proteins', meal.proteins)
    meal.fats = data.get('fats', meal.fats)
    meal.carbohydrates = data.get('carbohydrates', meal.carbohydrates)
    await sync_to_async(meal.save)()

    return data
