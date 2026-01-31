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
) -> ComplianceResult:
    """
    Проверяет соответствие приёма пищи программе питания.

    Args:
        meal: Приём пищи с распознанными ингредиентами
        program_day: День программы питания
        threshold: Порог fuzzy matching (0-100)

    Returns:
        ComplianceResult с результатами проверки
    """
    allowed = program_day.allowed_ingredients_list
    forbidden = program_day.forbidden_ingredients_list

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

    if compliance_result.is_compliant:
        # Проверяем есть ли кастомный промпт для похвалы
        if persona and persona.nutrition_program_prompt:
            template = persona.nutrition_program_prompt
            return template.format(
                status='compliant',
                allowed_ingredients=allowed_text,
                forbidden_ingredients=forbidden_text,
                found_forbidden='',
                program_name=program_day.program.name,
                day_number=program_day.day_number,
            )
        return 'Отлично! Вы соблюдаете программу питания.'

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
            )
        except KeyError:
            pass  # Если шаблон некорректный, используем дефолт

    allowed_recommendation = allowed_text if allowed_text else 'согласно вашей программе'
    return (
        f'Обнаружены продукты не из вашей программы: {found_forbidden_text}. '
        f'Сегодня рекомендуется: {allowed_recommendation}.'
    )


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

    if target_date is None:
        tz = get_client_timezone(client)
        target_date = meal.meal_time.astimezone(tz).date()

    # Проверяем наличие активной программы
    program = get_active_program_for_client(client, target_date)
    if not program:
        return None, ''

    # Получаем день программы
    program_day = get_program_day(program, target_date)
    if not program_day:
        return None, ''

    # Проверяем соответствие
    result = check_meal_compliance(meal, program_day)

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
    if not ingredients_list:
        return None

    result = process.extractOne(
        ingredient.lower(),
        [i.lower() for i in ingredients_list],
        scorer=fuzz.token_sort_ratio,
    )

    if result and result[1] >= threshold:
        # Возвращаем оригинальный ингредиент (с оригинальным регистром)
        idx = [i.lower() for i in ingredients_list].index(result[0])
        return ingredients_list[idx]

    return None


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
