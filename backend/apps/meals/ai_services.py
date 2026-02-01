"""AI сервисы для работы с блюдами и продуктами.

Модуль содержит функции для AI-генерации рецептов, расчёта КБЖУ,
подсказки описаний блюд и нутриентов продуктов.

SECURITY:
- sanitize_ai_input() защищает от prompt injection
- validate_ai_response() валидирует ответы AI
- Логирование не содержит sensitive data (названия блюд/продуктов)
"""

import hashlib
import html
import json
import logging
import re
from decimal import Decimal
from typing import TypedDict

from django.conf import settings

from core.ai.factory import get_ai_provider
from core.ai.utils import strip_markdown_codeblock

logger = logging.getLogger(__name__)


# ============================================================================
# SECURITY CONSTANTS
# ============================================================================

# Максимальные длины для входных данных
MAX_DISH_NAME_LENGTH = 200
MAX_PRODUCT_NAME_LENGTH = 200
MAX_INGREDIENT_NAME_LENGTH = 100
MAX_INGREDIENTS_COUNT = 50
MAX_INGREDIENTS_TEXT_LENGTH = 2000

# Паттерны prompt injection для фильтрации
INJECTION_PATTERNS = [
    r'ignore\s+(all\s+)?(previous|above|prior)',
    r'disregard\s+(all\s+)?(previous|above|prior)',
    r'forget\s+(all\s+)?(previous|above|prior)',
    r'new\s+instruction',
    r'system\s*:',
    r'assistant\s*:',
    r'user\s*:',
    r'\[\s*INST\s*\]',
    r'<\s*/?system\s*>',
    r'override',
    r'bypass',
    r'jailbreak',
]

# Компилируем паттерны для производительности
COMPILED_INJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE) for pattern in INJECTION_PATTERNS
]

# Диапазоны валидных значений КБЖУ
NUTRITION_LIMITS = {
    'calories': (0, 10000),      # ккал
    'calories_per_100g': (0, 900),  # ккал/100г (жир ~900)
    'proteins': (0, 500),        # г
    'proteins_per_100g': (0, 100),  # г/100г
    'fats': (0, 500),            # г
    'fats_per_100g': (0, 100),   # г/100г
    'carbohydrates': (0, 1000),  # г
    'carbs_per_100g': (0, 100),  # г/100г
}


# ============================================================================
# SECURITY FUNCTIONS
# ============================================================================

def _hash_for_log(value: str) -> str:
    """Создать короткий хэш для безопасного логирования.

    SECURITY: Не логируем названия блюд/продуктов напрямую,
    используем хэш для отладки без раскрытия данных.
    """
    return hashlib.sha256(value.encode()).hexdigest()[:8]


def sanitize_ai_input(
    text: str,
    max_length: int = MAX_DISH_NAME_LENGTH,
    field_name: str = 'input',
) -> str:
    """Санитизация пользовательского ввода перед отправкой в AI.

    SECURITY: Защита от prompt injection attacks.

    Args:
        text: Текст для санитизации.
        max_length: Максимальная длина текста.
        field_name: Название поля для логирования.

    Returns:
        Санитизированный текст.

    Raises:
        ValueError: Если обнаружена попытка injection или текст слишком длинный.
    """
    if not text:
        return ''

    text = text.strip()

    # Проверка длины
    if len(text) > max_length:
        logger.warning(
            f'SECURITY: Input too long for {field_name}: '
            f'length={len(text)}, max={max_length}, hash={_hash_for_log(text)}'
        )
        raise ValueError(f'{field_name} слишком длинный (максимум {max_length} символов)')

    # Проверка на prompt injection patterns
    for pattern in COMPILED_INJECTION_PATTERNS:
        if pattern.search(text):
            logger.warning(
                f'SECURITY: Potential prompt injection detected in {field_name}: '
                f'pattern={pattern.pattern}, hash={_hash_for_log(text)}'
            )
            raise ValueError(f'Недопустимые символы в {field_name}')

    # Удаляем потенциально опасные символы (сохраняем кириллицу, латиницу, цифры, базовую пунктуацию)
    # Разрешаем: буквы, цифры, пробелы, дефис, точка, запятая, апостроф, скобки
    sanitized = re.sub(r'[^\w\s\-.,\'\"()\[\]!?:;№°&/+]', '', text, flags=re.UNICODE)

    # Нормализуем пробелы
    sanitized = ' '.join(sanitized.split())

    if sanitized != text:
        logger.info(
            f'SECURITY: Input sanitized for {field_name}: '
            f'original_hash={_hash_for_log(text)}, sanitized_hash={_hash_for_log(sanitized)}'
        )

    return sanitized


def sanitize_ingredients_list(ingredients: list[dict]) -> list[dict]:
    """Санитизация списка ингредиентов.

    SECURITY: Валидация и санитизация каждого ингредиента.

    Args:
        ingredients: Список ингредиентов.

    Returns:
        Санитизированный список.

    Raises:
        ValueError: Если список невалиден.
    """
    if not isinstance(ingredients, list):
        raise ValueError('Ингредиенты должны быть списком')

    if len(ingredients) > MAX_INGREDIENTS_COUNT:
        raise ValueError(f'Слишком много ингредиентов (максимум {MAX_INGREDIENTS_COUNT})')

    sanitized = []
    for i, ing in enumerate(ingredients):
        if not isinstance(ing, dict):
            raise ValueError(f'Ингредиент #{i+1} должен быть объектом')

        name = sanitize_ai_input(
            str(ing.get('name', '')),
            max_length=MAX_INGREDIENT_NAME_LENGTH,
            field_name=f'ingredient_{i+1}_name',
        )

        weight = ing.get('weight', 0)
        if not isinstance(weight, (int, float)) or weight < 0 or weight > 10000:
            weight = 0

        sanitized.append({
            'name': name,
            'weight': int(weight),
        })

    return sanitized


def validate_nutrition_value(value: float, field: str) -> float:
    """Валидация значения КБЖУ.

    SECURITY: Проверка что значение в допустимых пределах.

    Args:
        value: Значение для проверки.
        field: Название поля.

    Returns:
        Валидное значение (или граничное если превышено).
    """
    try:
        value = float(value)
    except (TypeError, ValueError):
        return 0.0

    min_val, max_val = NUTRITION_LIMITS.get(field, (0, 10000))

    if value < min_val:
        return min_val
    if value > max_val:
        logger.warning(
            f'SECURITY: Nutrition value out of range: '
            f'field={field}, value={value}, max={max_val}'
        )
        return max_val

    return round(value, 2)


def sanitize_text_content(text: str, max_length: int = 5000) -> str:
    """Санитизация текстового контента от AI (рецепт, описание).

    SECURITY: Удаление потенциально опасного HTML/script контента.

    Args:
        text: Текст для санитизации.
        max_length: Максимальная длина.

    Returns:
        Безопасный текст.
    """
    if not text:
        return ''

    # Обрезаем по длине
    if len(text) > max_length:
        text = text[:max_length]

    # Экранируем HTML
    text = html.escape(text)

    # Восстанавливаем безопасные символы для markdown
    text = text.replace('&amp;', '&')
    text = text.replace('&#x27;', "'")

    return text


def validate_ai_recipe_response(data: dict) -> dict:
    """Полная валидация ответа AI для рецепта.

    SECURITY: Проверка всех полей на допустимые значения.

    Args:
        data: Данные от AI.

    Returns:
        Валидированные данные.
    """
    validated = {
        'dish_name': sanitize_text_content(str(data.get('dish_name', '')), 200),
        'portion_weight': min(max(int(data.get('portion_weight', 0)), 0), 10000),
        'cooking_time': min(max(int(data.get('cooking_time', 0)), 0), 1440),  # max 24 часа
        'recipe': sanitize_text_content(str(data.get('recipe', '')), 10000),
        'calories': validate_nutrition_value(data.get('calories', 0), 'calories'),
        'proteins': validate_nutrition_value(data.get('proteins', 0), 'proteins'),
        'fats': validate_nutrition_value(data.get('fats', 0), 'fats'),
        'carbohydrates': validate_nutrition_value(data.get('carbohydrates', 0), 'carbohydrates'),
        'ingredients': [],
    }

    # Валидация ингредиентов
    for ing in data.get('ingredients', [])[:MAX_INGREDIENTS_COUNT]:
        if not isinstance(ing, dict):
            continue
        validated['ingredients'].append({
            'name': sanitize_text_content(str(ing.get('name', '')), MAX_INGREDIENT_NAME_LENGTH),
            'weight': min(max(int(ing.get('weight', 0)), 0), 10000),
            'calories': validate_nutrition_value(ing.get('calories', 0), 'calories'),
            'proteins': validate_nutrition_value(ing.get('proteins', 0), 'proteins'),
            'fats': validate_nutrition_value(ing.get('fats', 0), 'fats'),
            'carbohydrates': validate_nutrition_value(ing.get('carbohydrates', 0), 'carbohydrates'),
        })

    return validated


def validate_ai_nutrition_response(data: dict) -> dict:
    """Валидация ответа AI для КБЖУ.

    Args:
        data: Данные от AI.

    Returns:
        Валидированные данные.
    """
    return {
        'calories': validate_nutrition_value(data.get('calories', 0), 'calories'),
        'proteins': validate_nutrition_value(data.get('proteins', 0), 'proteins'),
        'fats': validate_nutrition_value(data.get('fats', 0), 'fats'),
        'carbohydrates': validate_nutrition_value(data.get('carbohydrates', 0), 'carbohydrates'),
    }


def validate_ai_product_nutrition_response(data: dict) -> dict:
    """Валидация ответа AI для КБЖУ продукта.

    Args:
        data: Данные от AI.

    Returns:
        Валидированные данные.
    """
    return {
        'calories_per_100g': validate_nutrition_value(
            data.get('calories_per_100g', 0), 'calories_per_100g'
        ),
        'proteins_per_100g': validate_nutrition_value(
            data.get('proteins_per_100g', 0), 'proteins_per_100g'
        ),
        'fats_per_100g': validate_nutrition_value(
            data.get('fats_per_100g', 0), 'fats_per_100g'
        ),
        'carbs_per_100g': validate_nutrition_value(
            data.get('carbs_per_100g', 0), 'carbs_per_100g'
        ),
    }


# ============================================================================
# TYPE DEFINITIONS
# ============================================================================

class IngredientData(TypedDict):
    """Структура данных ингредиента."""

    name: str
    weight: int
    calories: float
    proteins: float
    fats: float
    carbohydrates: float


class RecipeData(TypedDict):
    """Структура данных сгенерированного рецепта."""

    dish_name: str
    portion_weight: int
    cooking_time: int
    ingredients: list[IngredientData]
    recipe: str
    calories: float
    proteins: float
    fats: float
    carbohydrates: float


class NutritionData(TypedDict):
    """Структура данных КБЖУ."""

    calories: float
    proteins: float
    fats: float
    carbohydrates: float


class ProductNutritionData(TypedDict):
    """Структура данных КБЖУ продукта на 100г."""

    calories_per_100g: float
    proteins_per_100g: float
    fats_per_100g: float
    carbs_per_100g: float


# ============================================================================
# PROMPTS
# ============================================================================

GENERATE_RECIPE_PROMPT = """Ты — профессиональный шеф-повар и диетолог. Создай подробный рецепт блюда.

ПРАВИЛА:
1. Верни ТОЛЬКО валидный JSON — без markdown, без объяснений
2. Все названия ингредиентов на РУССКОМ языке
3. Все числа должны быть целыми или десятичными (не строками)
4. Рецепт должен быть пошаговым и понятным
5. Ингредиенты должны быть реалистичными для данного блюда
6. КБЖУ должно соответствовать составу ингредиентов

ФОРМАТ JSON:
{
  "dish_name": "Полное название блюда на русском",
  "portion_weight": 350,
  "cooking_time": 30,
  "ingredients": [
    {
      "name": "Название ингредиента",
      "weight": 100,
      "calories": 80,
      "proteins": 5.0,
      "fats": 2.0,
      "carbohydrates": 10.0
    }
  ],
  "recipe": "1. Первый шаг\\n2. Второй шаг\\n3. Третий шаг...",
  "calories": 350,
  "proteins": 15.0,
  "fats": 12.0,
  "carbohydrates": 40.0
}

ВАЖНО:
- portion_weight — суммарный вес всех ингредиентов
- cooking_time — время приготовления в минутах
- calories, proteins, fats, carbohydrates — итоговые значения для всей порции
- Рецепт должен содержать минимум 3-5 шагов
- Ингредиентов должно быть минимум 3-5"""

CALCULATE_NUTRITION_PROMPT = """Ты — профессиональный диетолог. Рассчитай точное КБЖУ для списка ингредиентов.

ПРАВИЛА:
1. Верни ТОЛЬКО валидный JSON — без markdown
2. Все числа должны быть десятичными
3. Рассчитай КБЖУ для каждого ингредиента на основе его веса
4. Суммируй КБЖУ всех ингредиентов

ФОРМАТ JSON:
{
  "calories": 350.0,
  "proteins": 15.0,
  "fats": 12.0,
  "carbohydrates": 40.0
}"""

SUGGEST_PRODUCT_NUTRITION_PROMPT = """Ты — профессиональный диетолог. Определи КБЖУ продукта на 100 грамм.

ПРАВИЛА:
1. Верни ТОЛЬКО валидный JSON — без markdown
2. Все числа должны быть десятичными
3. Используй средние значения для данного продукта
4. Значения должны быть реалистичными

ФОРМАТ JSON:
{
  "calories_per_100g": 250.0,
  "proteins_per_100g": 10.0,
  "fats_per_100g": 5.0,
  "carbs_per_100g": 35.0
}"""

SUGGEST_DESCRIPTION_PROMPT = """Ты — кулинарный писатель. Напиши краткое аппетитное описание блюда.

ПРАВИЛА:
1. Верни ТОЛЬКО текст описания — без JSON, без кавычек
2. Описание должно быть на русском языке
3. Длина: 1-2 предложения (максимум 200 символов)
4. Стиль: аппетитный, привлекательный
5. Упомяни ключевые особенности блюда"""


# ============================================================================
# AI FUNCTIONS
# ============================================================================

async def generate_recipe(
    dish_name: str,
    provider_name: str | None = None,
    api_key: str | None = None,
) -> RecipeData:
    """Сгенерировать рецепт блюда по названию.

    SECURITY: Входные данные санитизируются, ответ AI валидируется.

    Args:
        dish_name: Название блюда для генерации рецепта.
        provider_name: Имя AI провайдера (по умолчанию из настроек).
        api_key: API ключ провайдера (по умолчанию из настроек).

    Returns:
        Словарь с данными рецепта: ингредиенты, рецепт, КБЖУ, время приготовления.

    Raises:
        ValueError: Если название блюда пустое или содержит недопустимые данные.
        RuntimeError: Если произошла ошибка при генерации.
    """
    if not dish_name or not dish_name.strip():
        raise ValueError('Название блюда не может быть пустым')

    # SECURITY: Санитизация входных данных
    dish_name = sanitize_ai_input(dish_name, MAX_DISH_NAME_LENGTH, 'dish_name')
    input_hash = _hash_for_log(dish_name)

    logger.info(f'Генерация рецепта: hash={input_hash}')

    try:
        provider = get_ai_provider(provider_name, api_key)

        response = await provider.complete(
            messages=[
                {'role': 'user', 'content': f'Создай рецепт блюда: {dish_name}'},
            ],
            system_prompt=GENERATE_RECIPE_PROMPT,
            json_mode=True,
            max_tokens=1500,
            temperature=0.7,
        )

        if response.is_error:
            logger.error(f'AI ошибка при генерации рецепта: hash={input_hash}, error={response.error_type}')
            raise RuntimeError(f'Ошибка AI: {response.content}')

        content = strip_markdown_codeblock(response.content)
        data = json.loads(content)

        # Валидация обязательных полей
        required_fields = ['dish_name', 'portion_weight', 'cooking_time', 'ingredients', 'recipe']
        for field in required_fields:
            if field not in data:
                raise ValueError(f'Отсутствует обязательное поле: {field}')

        # SECURITY: Валидация и санитизация ответа AI
        result: RecipeData = validate_ai_recipe_response(data)

        logger.info(
            f'Рецепт сгенерирован: hash={input_hash}, '
            f'ingredients_count={len(result["ingredients"])}, '
            f'calories={result["calories"]}'
        )
        return result

    except json.JSONDecodeError as e:
        logger.error(f'Ошибка парсинга JSON при генерации рецепта: hash={input_hash}, error={e}')
        raise RuntimeError(f'Ошибка парсинга ответа AI: {e}') from e
    except ValueError:
        raise
    except Exception as e:
        logger.error(f'Неожиданная ошибка при генерации рецепта: hash={input_hash}, error={e}')
        raise


async def calculate_nutrition_from_ingredients(
    ingredients: list[dict],
    provider_name: str | None = None,
    api_key: str | None = None,
) -> NutritionData:
    """Рассчитать КБЖУ по списку ингредиентов.

    SECURITY: Входные данные санитизируются, ответ AI валидируется.

    Args:
        ingredients: Список ингредиентов с названиями и весами.
        provider_name: Имя AI провайдера.
        api_key: API ключ провайдера.

    Returns:
        Словарь с КБЖУ: calories, proteins, fats, carbohydrates.

    Raises:
        ValueError: Если список ингредиентов пуст или невалиден.
        RuntimeError: Если произошла ошибка при расчёте.
    """
    if not ingredients:
        raise ValueError('Список ингредиентов не может быть пустым')

    # SECURITY: Санитизация списка ингредиентов
    sanitized_ingredients = sanitize_ingredients_list(ingredients)

    # Формируем текст ингредиентов
    ingredients_text = '\n'.join([
        f"- {ing['name']}: {ing['weight']}г"
        for ing in sanitized_ingredients
    ])

    # Проверка общей длины текста
    if len(ingredients_text) > MAX_INGREDIENTS_TEXT_LENGTH:
        raise ValueError('Список ингредиентов слишком большой')

    logger.info(f'Расчёт КБЖУ: ingredients_count={len(sanitized_ingredients)}')

    try:
        provider = get_ai_provider(provider_name, api_key)

        response = await provider.complete(
            messages=[
                {'role': 'user', 'content': f'Рассчитай КБЖУ для ингредиентов:\n{ingredients_text}'},
            ],
            system_prompt=CALCULATE_NUTRITION_PROMPT,
            json_mode=True,
            max_tokens=300,
            temperature=0.0,  # Детерминированный результат
        )

        if response.is_error:
            logger.error(f'AI ошибка при расчёте КБЖУ: error={response.error_type}')
            raise RuntimeError(f'Ошибка AI: {response.content}')

        content = strip_markdown_codeblock(response.content)
        data = json.loads(content)

        # SECURITY: Валидация ответа AI
        result: NutritionData = validate_ai_nutrition_response(data)

        logger.info(f'КБЖУ рассчитано: calories={result["calories"]}')
        return result

    except json.JSONDecodeError as e:
        logger.error(f'Ошибка парсинга JSON при расчёте КБЖУ: error={e}')
        raise RuntimeError(f'Ошибка парсинга ответа AI: {e}') from e
    except ValueError:
        raise
    except Exception as e:
        logger.error(f'Неожиданная ошибка при расчёте КБЖУ: error={e}')
        raise


async def suggest_product_nutrition(
    product_name: str,
    provider_name: str | None = None,
    api_key: str | None = None,
) -> ProductNutritionData:
    """Подсказать КБЖУ продукта на 100 грамм.

    SECURITY: Входные данные санитизируются, ответ AI валидируется.

    Args:
        product_name: Название продукта.
        provider_name: Имя AI провайдера.
        api_key: API ключ провайдера.

    Returns:
        Словарь с КБЖУ на 100г.

    Raises:
        ValueError: Если название продукта пустое или содержит недопустимые данные.
        RuntimeError: Если произошла ошибка при подсказке.
    """
    if not product_name or not product_name.strip():
        raise ValueError('Название продукта не может быть пустым')

    # SECURITY: Санитизация входных данных
    product_name = sanitize_ai_input(product_name, MAX_PRODUCT_NAME_LENGTH, 'product_name')
    input_hash = _hash_for_log(product_name)

    logger.info(f'Подсказка КБЖУ продукта: hash={input_hash}')

    try:
        provider = get_ai_provider(provider_name, api_key)

        response = await provider.complete(
            messages=[
                {'role': 'user', 'content': f'Определи КБЖУ на 100г для продукта: {product_name}'},
            ],
            system_prompt=SUGGEST_PRODUCT_NUTRITION_PROMPT,
            json_mode=True,
            max_tokens=200,
            temperature=0.0,  # Детерминированный результат
        )

        if response.is_error:
            logger.error(f'AI ошибка при подсказке КБЖУ продукта: hash={input_hash}, error={response.error_type}')
            raise RuntimeError(f'Ошибка AI: {response.content}')

        content = strip_markdown_codeblock(response.content)
        data = json.loads(content)

        # SECURITY: Валидация ответа AI
        result: ProductNutritionData = validate_ai_product_nutrition_response(data)

        logger.info(f'КБЖУ продукта подсказано: hash={input_hash}, calories={result["calories_per_100g"]}')
        return result

    except json.JSONDecodeError as e:
        logger.error(f'Ошибка парсинга JSON при подсказке КБЖУ: hash={input_hash}, error={e}')
        raise RuntimeError(f'Ошибка парсинга ответа AI: {e}') from e
    except ValueError:
        raise
    except Exception as e:
        logger.error(f'Неожиданная ошибка при подсказке КБЖУ: hash={input_hash}, error={e}')
        raise


async def suggest_dish_description(
    dish_name: str,
    provider_name: str | None = None,
    api_key: str | None = None,
) -> str:
    """Сгенерировать краткое описание блюда.

    SECURITY: Входные данные санитизируются, ответ AI валидируется.

    Args:
        dish_name: Название блюда.
        provider_name: Имя AI провайдера.
        api_key: API ключ провайдера.

    Returns:
        Краткое описание блюда (1-2 предложения).

    Raises:
        ValueError: Если название блюда пустое или содержит недопустимые данные.
        RuntimeError: Если произошла ошибка при генерации.
    """
    if not dish_name or not dish_name.strip():
        raise ValueError('Название блюда не может быть пустым')

    # SECURITY: Санитизация входных данных
    dish_name = sanitize_ai_input(dish_name, MAX_DISH_NAME_LENGTH, 'dish_name')
    input_hash = _hash_for_log(dish_name)

    logger.info(f'Генерация описания: hash={input_hash}')

    try:
        provider = get_ai_provider(provider_name, api_key)

        response = await provider.complete(
            messages=[
                {'role': 'user', 'content': f'Напиши краткое описание блюда: {dish_name}'},
            ],
            system_prompt=SUGGEST_DESCRIPTION_PROMPT,
            json_mode=False,  # Возвращаем текст, не JSON
            max_tokens=150,
            temperature=0.8,  # Креативность для описаний
        )

        if response.is_error:
            logger.error(f'AI ошибка при генерации описания: hash={input_hash}, error={response.error_type}')
            raise RuntimeError(f'Ошибка AI: {response.content}')

        description = response.content.strip()

        # Удаляем кавычки если есть
        if description.startswith('"') and description.endswith('"'):
            description = description[1:-1]

        # SECURITY: Санитизация ответа AI
        description = sanitize_text_content(description, 500)

        logger.info(f'Описание сгенерировано: hash={input_hash}, length={len(description)}')
        return description

    except ValueError:
        raise
    except Exception as e:
        logger.error(f'Неожиданная ошибка при генерации описания: hash={input_hash}, error={e}')
        raise
