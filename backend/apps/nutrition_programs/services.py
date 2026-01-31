from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import TYPE_CHECKING

import pytz
from django.db.models import QuerySet
from rapidfuzz import fuzz, process

if TYPE_CHECKING:
    from apps.accounts.models import Client
    from apps.meals.models import Meal

from .models import MealComplianceCheck, NutritionProgram, NutritionProgramDay


DEFAULT_TIMEZONE = 'Europe/Moscow'


@dataclass
class ComplianceResult:
    """Результат проверки соответствия приёма пищи программе питания."""

    is_compliant: bool
    found_forbidden: list[str]
    found_allowed: list[str]
    neutral: list[str]  # ингредиенты, которых нет ни в одном списке
    meal_type: str | None = None  # тип приёма пищи (breakfast, lunch, dinner, snack)
    planned_meal: dict | None = None  # запланированное блюдо из программы
    matches_planned: bool = True  # соответствует ли запланированному блюду


# Временные диапазоны для определения типа приёма пищи
MEAL_TIME_RANGES = {
    'breakfast': (6, 10),   # 6:00 - 10:00
    'snack1': (10, 12),     # 10:00 - 12:00
    'lunch': (12, 15),      # 12:00 - 15:00
    'snack2': (15, 18),     # 15:00 - 18:00
    'dinner': (18, 22),     # 18:00 - 22:00
}


def get_meal_type_by_time(meal_time: datetime, client_tz: pytz.BaseTzInfo = None) -> str:
    """
    Определяет тип приёма пищи по времени.

    Args:
        meal_time: Время приёма пищи
        client_tz: Timezone клиента (опционально)

    Returns:
        Тип приёма пищи: breakfast, snack1, lunch, snack2, dinner
    """
    if client_tz:
        local_time = meal_time.astimezone(client_tz)
    else:
        local_time = meal_time

    hour = local_time.hour

    for meal_type, (start_hour, end_hour) in MEAL_TIME_RANGES.items():
        if start_hour <= hour < end_hour:
            return meal_type

    # По умолчанию - перекус
    if hour < 6:
        return 'dinner'  # поздний ужин
    return 'snack2'  # поздний перекус


def get_client_timezone(client: Client) -> pytz.BaseTzInfo:
    """
    Безопасно получает timezone клиента.

    Returns:
        Timezone клиента или дефолтный если невалидный
    """
    try:
        return pytz.timezone(client.timezone or DEFAULT_TIMEZONE)
    except pytz.UnknownTimezoneError:
        return pytz.timezone(DEFAULT_TIMEZONE)


def get_client_today(client: Client) -> date:
    """Возвращает текущую дату в timezone клиента."""
    tz = get_client_timezone(client)
    return datetime.now(tz).date()


def get_active_program_for_client(
    client: Client,
    target_date: date | None = None,
) -> NutritionProgram | None:
    """
    Возвращает активную программу питания для клиента на указанную дату.

    Args:
        client: Клиент
        target_date: Дата для проверки (если None — используется сегодня в timezone клиента)

    Returns:
        Активная программа или None
    """
    if target_date is None:
        target_date = get_client_today(client)

    return NutritionProgram.objects.filter(
        client=client,
        status='active',
        start_date__lte=target_date,
        end_date__gte=target_date,
    ).first()


def get_program_day(
    program: NutritionProgram,
    target_date: date,
) -> NutritionProgramDay | None:
    """
    Возвращает день программы для конкретной даты.

    Args:
        program: Программа питания
        target_date: Дата

    Returns:
        День программы или None если дата вне диапазона программы
    """
    if target_date < program.start_date or target_date > program.end_date:
        return None

    day_number = (target_date - program.start_date).days + 1

    return NutritionProgramDay.objects.filter(
        program=program,
        day_number=day_number,
    ).first()


def check_meal_compliance(
    meal: Meal,
    program_day: NutritionProgramDay,
    threshold: int = 80,
    client_tz: pytz.BaseTzInfo | None = None,
) -> ComplianceResult:
    """
    Проверяет соответствие приёма пищи программе питания.

    Args:
        meal: Приём пищи с распознанными ингредиентами
        program_day: День программы питания
        threshold: Порог fuzzy matching (0-100)
        client_tz: Timezone клиента для определения типа приёма пищи

    Returns:
        ComplianceResult с результатами проверки
    """
    allowed = program_day.allowed_ingredients_list
    forbidden = program_day.forbidden_ingredients_list

    # Определяем тип приёма пищи по времени
    meal_type = None
    planned_meal = None
    matches_planned = True

    if meal.meal_time:
        meal_type = get_meal_type_by_time(meal.meal_time, client_tz)
        # Получаем запланированное блюдо из программы
        planned_meal = program_day.get_meal_by_type(meal_type)

        # Если есть запланированное блюдо, проверяем соответствие названию
        if planned_meal and meal.dish_name:
            planned_name = planned_meal.get('name', '') or planned_meal.get('description', '')
            if planned_name:
                # Fuzzy сравнение названий блюд
                similarity = fuzz.token_sort_ratio(
                    meal.dish_name.lower(),
                    planned_name.lower()
                )
                matches_planned = similarity >= 50  # Порог соответствия названия

    # Получаем ингредиенты из meal
    meal_ingredients = []
    for ing in meal.ingredients or []:
        name = ing.get('name') if isinstance(ing, dict) else str(ing)
        if name:
            meal_ingredients.append(name)

    found_forbidden = []
    found_allowed = []
    neutral = []

    for ingredient in meal_ingredients:
        # Проверяем в запрещённых
        forbidden_match = find_ingredient_match(ingredient, forbidden, threshold)
        if forbidden_match:
            found_forbidden.append(ingredient)
            continue

        # Проверяем в разрешённых
        allowed_match = find_ingredient_match(ingredient, allowed, threshold)
        if allowed_match:
            found_allowed.append(ingredient)
            continue

        # Ингредиент не в списках
        neutral.append(ingredient)

    # Нарушение если есть запрещённые ингредиенты
    is_compliant = len(found_forbidden) == 0

    return ComplianceResult(
        is_compliant=is_compliant,
        found_forbidden=found_forbidden,
        found_allowed=found_allowed,
        neutral=neutral,
        meal_type=meal_type,
        planned_meal=planned_meal,
        matches_planned=matches_planned,
    )


def generate_compliance_feedback(
    compliance_result: ComplianceResult,
    program_day: NutritionProgramDay,
    persona=None,
) -> str:
    """
    Генерирует текст замечания или похвалы на основе результата проверки.

    Args:
        compliance_result: Результат проверки
        program_day: День программы питания
        persona: Персона бота (опционально, для кастомного промпта)

    Returns:
        Текст для пользователя
    """
    allowed = program_day.allowed_ingredients_list[:5]
    forbidden_list = program_day.forbidden_ingredients_list[:5]
    allowed_text = ', '.join(allowed) if allowed else ''
    forbidden_text = ', '.join(forbidden_list) if forbidden_list else ''

    # Информация о запланированном блюде
    planned_meal_text = ''
    if compliance_result.planned_meal:
        planned_name = (
            compliance_result.planned_meal.get('name')
            or compliance_result.planned_meal.get('description', '')
        )
        if planned_name:
            planned_meal_text = planned_name[:100]

    if compliance_result.is_compliant:
        # Проверяем соответствие запланированному блюду
        feedback_parts = []

        if compliance_result.matches_planned and planned_meal_text:
            feedback_parts.append(
                f'Отлично! Вы съели запланированное блюдо: {planned_meal_text}.'
            )
        elif not compliance_result.matches_planned and planned_meal_text:
            feedback_parts.append(
                f'Хорошо, но на этот приём пищи было запланировано: {planned_meal_text}.'
            )
        else:
            feedback_parts.append('Отлично! Вы соблюдаете программу питания.')

        # Проверяем есть ли кастомный промпт для похвалы
        if persona and persona.nutrition_program_prompt:
            template = persona.nutrition_program_prompt
            try:
                return template.format(
                    status='compliant',
                    allowed_ingredients=allowed_text,
                    forbidden_ingredients=forbidden_text,
                    found_forbidden='',
                    program_name=program_day.program.name,
                    day_number=program_day.day_number,
                    planned_meal=planned_meal_text,
                    matches_planned=compliance_result.matches_planned,
                )
            except KeyError:
                pass  # Если шаблон некорректный, используем дефолт

        return ' '.join(feedback_parts)

    found_forbidden_text = ', '.join(compliance_result.found_forbidden)

    # Проверяем есть ли кастомный промпт
    if persona and persona.nutrition_program_prompt:
        template = persona.nutrition_program_prompt
        try:
            return template.format(
                status='violation',
                allowed_ingredients=allowed_text,
                forbidden_ingredients=forbidden_text,
                found_forbidden=found_forbidden_text,
                program_name=program_day.program.name,
                day_number=program_day.day_number,
                planned_meal=planned_meal_text,
                matches_planned=compliance_result.matches_planned,
            )
        except KeyError:
            pass  # Если шаблон некорректный, используем дефолт

    # Дефолтный feedback с информацией о запланированном блюде
    feedback = f'Обнаружены продукты не из вашей программы: {found_forbidden_text}.'
    if planned_meal_text:
        feedback += f' Запланировано было: {planned_meal_text}.'
    elif allowed_text:
        feedback += f' Сегодня рекомендуется: {allowed_text}.'

    return feedback


def create_compliance_check(
    meal: Meal,
    program_day: NutritionProgramDay,
    compliance_result: ComplianceResult,
    ai_comment: str = '',
) -> MealComplianceCheck:
    """
    Создаёт запись проверки соответствия в БД.

    Args:
        meal: Приём пищи
        program_day: День программы
        compliance_result: Результат проверки
        ai_comment: Комментарий AI

    Returns:
        Созданный объект MealComplianceCheck
    """
    return MealComplianceCheck.objects.create(
        meal=meal,
        program_day=program_day,
        is_compliant=compliance_result.is_compliant,
        found_forbidden=compliance_result.found_forbidden,
        found_allowed=compliance_result.found_allowed,
        ai_comment=ai_comment,
    )


def process_meal_compliance(
    meal: Meal,
    target_date: date | None = None,
) -> tuple[MealComplianceCheck | None, str]:
    """
    Полный flow проверки приёма пищи на соответствие программе питания.

    Args:
        meal: Приём пищи
        target_date: Дата (если None — берётся из meal_time)

    Returns:
        Кортеж (MealComplianceCheck или None, текст feedback)
    """
    client = meal.client
    client_tz = get_client_timezone(client)

    if target_date is None:
        target_date = meal.meal_time.astimezone(client_tz).date()

    # Проверяем наличие активной программы
    program = get_active_program_for_client(client, target_date)
    if not program:
        return None, ''

    # Получаем день программы
    program_day = get_program_day(program, target_date)
    if not program_day:
        return None, ''

    # Проверяем соответствие с учётом типа приёма пищи
    result = check_meal_compliance(meal, program_day, client_tz=client_tz)

    # Получаем персону клиента для кастомного промпта
    persona = client.persona
    if not persona:
        from apps.persona.models import BotPersona
        persona = BotPersona.objects.filter(coach=client.coach, is_default=True).first()

    # Генерируем feedback
    feedback = generate_compliance_feedback(result, program_day, persona)

    # Сохраняем проверку
    check = create_compliance_check(meal, program_day, result, feedback)

    return check, feedback


def get_program_stats(program: NutritionProgram) -> dict:
    """
    Возвращает статистику по программе питания.

    Args:
        program: Программа питания

    Returns:
        Словарь со статистикой
    """
    checks = MealComplianceCheck.objects.filter(program_day__program=program)

    total_meals = checks.count()
    compliant_meals = checks.filter(is_compliant=True).count()
    violations = total_meals - compliant_meals

    compliance_percentage = (
        round(compliant_meals / total_meals * 100) if total_meals > 0 else 0
    )

    return {
        'total_meals': total_meals,
        'compliant_meals': compliant_meals,
        'violations': violations,
        'compliance_percentage': compliance_percentage,
    }


def find_ingredient_match(
    ingredient: str,
    ingredients_list: list[str],
    threshold: int = 80,
) -> str | None:
    """
    Находит наиболее похожий ингредиент в списке с использованием fuzzy matching.

    Args:
        ingredient: Ингредиент для поиска
        ingredients_list: Список ингредиентов для сравнения
        threshold: Минимальный порог совпадения (0-100)

    Returns:
        Найденный ингредиент из списка или None если совпадение < threshold

    Примеры:
        - "сахар" → "Сахар белый" (match)
        - "куринная грудка" → "куриная грудка" (match, опечатка)
        - "хлеб белый" → "белый хлеб" (match, порядок слов)
        - "яблоко" → "груша" (no match)
    """
    if not ingredients_list or not ingredient or not ingredient.strip():
        return None

    # Создаём список lowercase один раз для переиспользования
    lower_list = [i.lower() for i in ingredients_list]

    result = process.extractOne(
        ingredient.lower(),
        lower_list,
        scorer=fuzz.token_sort_ratio,
    )

    if result and result[1] >= threshold:
        # Возвращаем оригинальный ингредиент (с оригинальным регистром)
        idx = lower_list.index(result[0])
        return ingredients_list[idx]

    return None


async def analyze_meal_report(
    meal_report: 'MealReport',
    image_data: bytes,
) -> dict:
    """
    Анализирует фото-отчёт и сравнивает с запланированным меню.

    Args:
        meal_report: Объект MealReport с информацией о приёме пищи
        image_data: Бинарные данные изображения

    Returns:
        Словарь с результатами анализа:
        - recognized_ingredients: список распознанных ингредиентов
        - is_compliant: соответствует ли фото запланированному
        - compliance_score: оценка соответствия (0-100)
        - ai_analysis: текстовый анализ от AI
        - found_forbidden: найденные запрещённые ингредиенты
        - found_allowed: найденные разрешённые ингредиенты
    """
    import json
    import logging
    from decimal import Decimal

    from asgiref.sync import sync_to_async

    from apps.persona.models import AIProviderConfig, AIUsageLog, BotPersona, TelegramBot
    from core.ai.factory import get_ai_provider
    from core.ai.model_fetcher import get_cached_pricing

    logger = logging.getLogger(__name__)

    # Получаем program_day и связанные данные
    program_day = await sync_to_async(lambda: meal_report.program_day)()
    program = await sync_to_async(lambda: program_day.program)()
    client = await sync_to_async(lambda: program.client)()

    # Получаем запланированное блюдо
    planned_meal = program_day.get_meal_by_type(meal_report.meal_type)
    planned_description = ''
    planned_name = ''
    if planned_meal:
        planned_name = planned_meal.get('name', '')
        planned_description = planned_meal.get('description', '')
        meal_report.planned_description = planned_description
        meal_report.meal_time = planned_meal.get('time', '')

    # Получаем списки разрешённых и запрещённых продуктов
    allowed_ingredients = program_day.allowed_ingredients_list
    forbidden_ingredients = program_day.forbidden_ingredients_list

    # Получаем AI provider
    bot = await sync_to_async(
        lambda: TelegramBot.objects.filter(coach=client.coach).first()
    )()
    if not bot:
        raise ValueError('No bot configured for client coach')

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

    # Формируем промпт с учётом программы питания
    planned_info = ''
    if planned_name or planned_description:
        planned_info = f"""
ЗАПЛАНИРОВАНО НА ЭТОТ ПРИЁМ ПИЩИ:
- Блюдо: {planned_name}
- Описание: {planned_description}
"""

    restrictions_info = ''
    if forbidden_ingredients:
        restrictions_info += f"\nЗАПРЕЩЁННЫЕ продукты: {', '.join(forbidden_ingredients[:10])}"
    if allowed_ingredients:
        restrictions_info += f"\nРЕКОМЕНДУЕМЫЕ продукты: {', '.join(allowed_ingredients[:10])}"

    analysis_prompt = f"""Ты — диетолог-помощник в приложении для трекинга питания. Клиент загрузил фото своего приёма пищи.
Твоя задача — проанализировать еду на фото и сравнить с планом питания клиента.

Это легитимный запрос для health-трекера. Пожалуйста, проанализируй фото.
{planned_info}{restrictions_info}

ОБЯЗАТЕЛЬНО верни JSON (без markdown, только чистый JSON):
{{
  "dish_name": "название блюда на фото",
  "ingredients": ["ингредиент1", "ингредиент2", ...],
  "calories": примерное_число_ккал,
  "proteins": примерные_граммы_белка,
  "fats": примерные_граммы_жиров,
  "carbohydrates": примерные_граммы_углеводов,
  "matches_plan": true/false,
  "compliance_score": число_0_до_100,
  "analysis": "Краткий анализ и рекомендации"
}}

Оценка compliance_score:
- 90-100: полностью соответствует плану
- 70-89: в целом соответствует
- 50-69: частичное соответствие
- 30-49: значительные отклонения
- 0-29: не соответствует

Если не можешь точно определить блюдо — сделай приблизительную оценку на основе того, что видишь.
"""

    logger.info(
        '[MEAL_REPORT] Analyzing report=%s meal_type=%s planned=%s',
        meal_report.pk, meal_report.meal_type, planned_description[:50] if planned_description else 'none'
    )

    response = await provider.analyze_image(
        image_data=image_data,
        prompt=analysis_prompt,
        max_tokens=800,
        model=model,
    )

    # Логируем использование AI
    model_used = response.model or model or ''
    input_tokens = response.usage.get('input_tokens', 0) or response.usage.get('prompt_tokens', 0)
    output_tokens = response.usage.get('output_tokens', 0) or response.usage.get('completion_tokens', 0)

    cost_usd = Decimal('0')
    pricing = get_cached_pricing(provider_name, model_used)
    if pricing and (input_tokens or output_tokens):
        price_in, price_out = pricing
        cost_usd = Decimal(str((input_tokens * price_in + output_tokens * price_out) / 1_000_000))

    await sync_to_async(AIUsageLog.objects.create)(
        coach=client.coach,
        provider=provider_name,
        model=model_used,
        task_type='vision',
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )

    # Парсим ответ
    content = response.content.strip()
    if content.startswith('```'):
        content = content.split('\n', 1)[1] if '\n' in content else content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

    # Проверяем не отказался ли AI анализировать
    refusal_markers = ['извините', 'не могу', "i can't", "i cannot", "sorry", "unable to"]
    is_refusal = any(marker in content.lower() for marker in refusal_markers)

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        if is_refusal:
            logger.warning('[MEAL_REPORT] AI refused to analyze image: %s', content[:200])
            data = {
                'dish_name': 'Блюдо на фото',
                'calories': 0,
                'proteins': 0,
                'fats': 0,
                'carbohydrates': 0,
                'ingredients': [],
                'compliance_score': 50,
                'matches_plan': False,
                'analysis': 'AI не смог распознать блюдо. Попробуйте сделать более чёткое фото еды.',
            }
        else:
            logger.error('[MEAL_REPORT] Failed to parse JSON: %s', content[:500])
            data = {
                'dish_name': 'Неизвестное блюдо',
                'calories': 0,
                'proteins': 0,
                'fats': 0,
                'carbohydrates': 0,
                'ingredients': [],
                'compliance_score': 50,
                'matches_plan': False,
                'analysis': 'Не удалось распознать блюдо на фото.',
            }

    # Извлекаем данные из ответа AI
    recognized = data.get('ingredients', [])
    recognized_dish = data.get('dish_name', 'Неизвестное блюдо')
    ai_compliance_score = data.get('compliance_score', 50)
    matches_plan = data.get('matches_plan', False)
    ai_analysis_text = data.get('analysis', '')

    # Дополнительно проверяем ингредиенты через fuzzy matching
    found_forbidden = []
    found_allowed = []

    for ingredient in recognized:
        if isinstance(ingredient, dict):
            ingredient = ingredient.get('name', '')
        if not ingredient:
            continue

        # Проверяем на запрещённые
        forbidden_match = find_ingredient_match(
            ingredient, forbidden_ingredients, threshold=75
        )
        if forbidden_match:
            found_forbidden.append(ingredient)
            continue

        # Проверяем на разрешённые
        allowed_match = find_ingredient_match(
            ingredient, allowed_ingredients, threshold=75
        )
        if allowed_match:
            found_allowed.append(ingredient)

    # Используем оценку от AI, но корректируем если найдены запрещённые
    compliance_score = ai_compliance_score
    if found_forbidden:
        # Снижаем score если найдены запрещённые ингредиенты
        penalty = len(found_forbidden) * 15
        compliance_score = max(0, min(compliance_score, 40) - penalty)

    is_compliant = compliance_score >= 70 and len(found_forbidden) == 0

    # Формируем финальный анализ
    analysis_parts = []

    # Сначала AI анализ
    if ai_analysis_text:
        analysis_parts.append(ai_analysis_text)

    # Добавляем информацию о запрещённых если AI не упомянул
    if found_forbidden and 'запрещ' not in ai_analysis_text.lower():
        analysis_parts.append(f"Обнаружены запрещённые продукты: {', '.join(found_forbidden)}")

    if not analysis_parts:
        if recognized_dish and recognized_dish != 'Неизвестное блюдо':
            analysis_parts.append(f'Распознано: {recognized_dish}')
        analysis_parts.append('Анализ завершён.')

    ai_analysis = ' '.join(analysis_parts)

    result = {
        'recognized_ingredients': [
            {'name': ing} if isinstance(ing, str) else ing
            for ing in recognized
        ],
        'is_compliant': is_compliant,
        'compliance_score': compliance_score,
        'ai_analysis': ai_analysis,
        'found_forbidden': found_forbidden,
        'found_allowed': found_allowed,
        'recognized_dish': recognized_dish,
        'matches_plan': matches_plan,
        'calories': data.get('calories', 0),
        'proteins': data.get('proteins', 0),
        'fats': data.get('fats', 0),
        'carbohydrates': data.get('carbohydrates', 0),
    }

    # Обновляем MealReport
    meal_report.recognized_ingredients = result['recognized_ingredients']
    meal_report.is_compliant = result['is_compliant']
    meal_report.compliance_score = result['compliance_score']
    meal_report.ai_analysis = result['ai_analysis']
    await sync_to_async(meal_report.save)()

    logger.info(
        '[MEAL_REPORT] Analysis complete: report=%s compliant=%s score=%s forbidden=%s',
        meal_report.pk, is_compliant, compliance_score, found_forbidden
    )

    return result


def find_all_matches(
    ingredient: str,
    ingredients_list: list[str],
    threshold: int = 80,
    limit: int = 3,
) -> list[tuple[str, int]]:
    """
    Находит все похожие ингредиенты в списке.

    Args:
        ingredient: Ингредиент для поиска
        ingredients_list: Список ингредиентов для сравнения
        threshold: Минимальный порог совпадения (0-100)
        limit: Максимальное количество результатов

    Returns:
        Список кортежей (ингредиент, score) отсортированных по убыванию score
    """
    if not ingredients_list:
        return []

    results = process.extract(
        ingredient.lower(),
        [i.lower() for i in ingredients_list],
        scorer=fuzz.token_sort_ratio,
        limit=limit,
    )

    matches = []
    for match, score, idx in results:
        if score >= threshold:
            matches.append((ingredients_list[idx], score))

    return matches
