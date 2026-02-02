from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import TYPE_CHECKING

import pytz
from django.db.models import QuerySet
from rapidfuzz import fuzz, process

from core.ai.utils import strip_markdown_codeblock

if TYPE_CHECKING:
    from apps.accounts.models import Client
    from apps.meals.models import Meal

from .models import MealComplianceCheck, NutritionProgram, NutritionProgramDay


DEFAULT_TIMEZONE = 'Europe/Moscow'


@dataclass
class ComplianceResult:
    """Результат проверки соответствия приёма пищи программе питания."""

    is_compliant: bool
    compliance_score: int  # 0-100, оценка соответствия плану
    meal_type: str | None = None  # тип приёма пищи (breakfast, lunch, dinner, snack)
    planned_meal: dict | None = None  # запланированное блюдо из программы
    recognized_dish: str = ''  # что распознано на фото
    ai_analysis: str = ''  # анализ от AI


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
    client_tz: pytz.BaseTzInfo | None = None,
) -> ComplianceResult:
    """
    Проверяет соответствие приёма пищи программе питания.

    Оценка основана на сравнении названия/описания блюда с планом коуча.

    Args:
        meal: Приём пищи с распознанным названием
        program_day: День программы питания
        client_tz: Timezone клиента для определения типа приёма пищи

    Returns:
        ComplianceResult с результатами проверки
    """
    # Определяем тип приёма пищи по времени
    meal_type = None
    planned_meal = None
    compliance_score = 70  # По умолчанию средний score

    if meal.meal_time:
        meal_type = get_meal_type_by_time(meal.meal_time, client_tz)
        # Получаем запланированное блюдо из программы
        planned_meal = program_day.get_meal_by_type(meal_type)

        # Если есть запланированное блюдо, проверяем соответствие
        if planned_meal and meal.dish_name:
            planned_name = planned_meal.get('name', '')
            planned_description = planned_meal.get('description', '')
            planned_text = f"{planned_name} {planned_description}".strip()

            if planned_text:
                # Fuzzy сравнение названий блюд
                similarity = fuzz.token_sort_ratio(
                    meal.dish_name.lower(),
                    planned_text.lower()
                )
                # Преобразуем similarity в compliance_score
                compliance_score = similarity

    is_compliant = compliance_score >= 70

    return ComplianceResult(
        is_compliant=is_compliant,
        compliance_score=compliance_score,
        meal_type=meal_type,
        planned_meal=planned_meal,
        recognized_dish=meal.dish_name or '',
    )


def generate_compliance_feedback(
    compliance_result: ComplianceResult,
    program_day: NutritionProgramDay,
    persona=None,
) -> str:
    """
    Генерирует текст замечания или похвалы на основе результата проверки.

    Оценка основана на соответствии блюда плану от коуча.

    Args:
        compliance_result: Результат проверки
        program_day: День программы питания
        persona: Персона бота (опционально, для кастомного промпта)

    Returns:
        Текст для пользователя
    """
    # Информация о запланированном блюде
    planned_meal_text = ''
    if compliance_result.planned_meal:
        planned_name = compliance_result.planned_meal.get('name', '')
        planned_description = compliance_result.planned_meal.get('description', '')
        planned_meal_text = planned_description or planned_name
        planned_meal_text = planned_meal_text[:150]

    recognized = compliance_result.recognized_dish
    score = compliance_result.compliance_score

    # Используем AI анализ если есть
    if compliance_result.ai_analysis:
        return compliance_result.ai_analysis

    # Генерируем feedback на основе score
    if score >= 90:
        if planned_meal_text:
            return f'Отлично! Блюдо полностью соответствует плану: {planned_meal_text}.'
        return 'Отлично! Вы соблюдаете программу питания.'

    if score >= 70:
        if planned_meal_text:
            return f'Хорошо! Блюдо в целом соответствует плану ({planned_meal_text}).'
        return 'Хорошо! Блюдо в целом соответствует программе.'

    if score >= 50:
        if planned_meal_text:
            return f'Частичное соответствие. По плану было: {planned_meal_text}.'
        return 'Частичное соответствие программе питания.'

    # score < 50
    if planned_meal_text:
        return f'Блюдо отличается от плана. Запланировано было: {planned_meal_text}.'
    return 'Блюдо не соответствует программе питания.'


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
        found_forbidden=[],  # Deprecated: оставлено для обратной совместимости
        found_allowed=[],  # Deprecated: оставлено для обратной совместимости
        ai_comment=ai_comment or compliance_result.ai_analysis,
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

    # Загружаем предыдущие фото-отчёты для этого же приёма пищи (того же дня и типа)
    from apps.nutrition_programs.models import MealReport
    previous_reports = await sync_to_async(
        lambda: list(
            MealReport.objects.filter(
                program_day=program_day,
                meal_type=meal_report.meal_type,
            ).exclude(
                pk=meal_report.pk  # Исключаем текущий отчёт
            ).order_by('created_at').values(
                'ai_analysis', 'compliance_score', 'recognized_ingredients'
            )[:5]  # Максимум 5 предыдущих фото
        )
    )()

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
- Название: {planned_name}
- Описание от коуча: {planned_description}
"""

    # Формируем информацию о предыдущих фото этого приёма пищи
    previous_photos_info = ''
    if previous_reports:
        previous_items = []
        for i, report in enumerate(previous_reports, 1):
            ingredients = report.get('recognized_ingredients', [])
            ingredients_text = ', '.join(
                ing.get('name', ing) if isinstance(ing, dict) else str(ing)
                for ing in ingredients[:5]
            ) if ingredients else 'не определено'

            ai_comment = report.get('ai_analysis', '')
            # Обрезаем комментарий если слишком длинный
            if ai_comment and len(ai_comment) > 150:
                ai_comment = ai_comment[:150] + '...'

            photo_info = f"  Фото {i}: {ingredients_text}"
            if ai_comment:
                photo_info += f"\n    → Твой комментарий: {ai_comment}"
            previous_items.append(photo_info)

        previous_photos_info = f"""
УЖЕ ЗАГРУЖЕНЫ ФОТО ЭТОГО ПРИЁМА ПИЩИ (от клиента):
{chr(10).join(previous_items)}

ВАЖНО: Это продолжение того же приёма пищи! Учитывай контекст предыдущих фото.
- Не повторяй то, что уже сказал
- Если часть плана уже на предыдущих фото — не требуй её снова
- Дай краткий итоговый комментарий с учётом ВСЕХ фото
"""

    analysis_prompt = f"""Ты — диетолог-помощник в приложении для трекинга питания. Клиент загрузил фото своего приёма пищи.
Твоя задача — проанализировать еду на фото и сравнить с планом питания от коуча.

Это легитимный запрос для health-трекера. Пожалуйста, проанализируй фото.
{planned_info}{previous_photos_info}

ВАЖНЫЕ ПРАВИЛА ОЦЕНКИ:

1. СООТВЕТСТВИЕ ПЛАНУ — главный критерий. Сравнивай то что на фото с описанием блюда от коуча.

2. На фото может быть НЕСКОЛЬКО блюд/компонентов (например: каша + фрукт + напиток).
   Перечисли ВСЕ что видишь на фото.

3. Клиент может присылать НЕСКОЛЬКО ФОТО на один приём пищи.
   Оценивай это фото как ЧАСТЬ приёма. Если часть плана уже на предыдущих фото — не снижай оценку за её отсутствие здесь.

4. Критерии оценки соответствия:
   - Основное блюдо совпадает с планом? (каша = каша, салат = салат)
   - Ключевые ингредиенты присутствуют?
   - Общий характер блюда соответствует?

5. НЕ снижай оценку за:
   - Небольшие вариации в рамках той же категории продуктов
   - Дополнительные полезные компоненты
   - Конкретный продукт когда в плане указана общая категория (яблоко = фрукт, гречка = каша)
   - Используй здравый смысл при оценке соответствия!

6. СНИЖАЙ оценку за:
   - Полностью другое блюдо (вместо каши — бутерброд)
   - Отсутствие ключевых компонентов из плана
   - Замену конкретного продукта на другой (в плане "индейка" → свинина НЕ подходит)
   - Очевидно нездоровая замена

ОБЯЗАТЕЛЬНО верни JSON (без markdown, только чистый JSON):
{{
  "dishes_on_photo": ["блюдо1", "блюдо2", ...],
  "ingredients": ["ингредиент1", "ингредиент2", ...],
  "calories": примерное_число_ккал,
  "proteins": примерные_граммы_белка,
  "fats": примерные_граммы_жиров,
  "carbohydrates": примерные_граммы_углеводов,
  "matches_plan": true/false,
  "compliance_score": число_0_до_100,
  "analysis": "Что на фото, как соотносится с планом, краткий вывод"
}}

Оценка compliance_score:
- 90-100: блюдо полностью соответствует плану коуча
- 70-89: блюдо в целом соответствует (небольшие вариации)
- 50-69: частичное соответствие (есть существенные отличия)
- 30-49: значительные отклонения от плана
- 0-29: блюдо не соответствует плану

Если план не указан — оцени насколько блюдо выглядит здоровым и сбалансированным (score 50-80).
Если не можешь определить блюдо — сделай приблизительную оценку на основе того, что видишь.
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
        temperature=0.2,  # Низкая температура для стабильного анализа
    )

    # Логируем использование AI
    from core.ai.model_fetcher import log_ai_usage
    await log_ai_usage(client.coach, provider_name, model, response, task_type='vision', client=client)

    # Парсим ответ
    content = strip_markdown_codeblock(response.content)

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
    dishes_on_photo = data.get('dishes_on_photo', [])
    # Для обратной совместимости: если dishes_on_photo пуст, используем dish_name
    if not dishes_on_photo:
        dish_name = data.get('dish_name', '')
        if dish_name:
            dishes_on_photo = [dish_name]
    recognized_dish = ', '.join(dishes_on_photo) if dishes_on_photo else 'Неизвестное блюдо'

    compliance_score = data.get('compliance_score', 50)
    matches_plan = data.get('matches_plan', False)
    ai_analysis_text = data.get('analysis', '')

    # Оценка соответствия: полностью на основе AI анализа
    # AI сравнивает фото с описанием блюда от коуча
    is_compliant = compliance_score >= 70

    # Формируем финальный анализ
    ai_analysis = ai_analysis_text if ai_analysis_text else f'Распознано: {recognized_dish}'

    result = {
        'recognized_ingredients': [
            {'name': ing} if isinstance(ing, str) else ing
            for ing in recognized
        ],
        'dishes_on_photo': dishes_on_photo,
        'is_compliant': is_compliant,
        'compliance_score': compliance_score,
        'ai_analysis': ai_analysis,
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
        '[MEAL_REPORT] Analysis complete: report=%s compliant=%s score=%s dishes=%s',
        meal_report.pk, is_compliant, compliance_score, dishes_on_photo
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
