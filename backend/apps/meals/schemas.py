"""Pydantic схемы для валидации ответов AI при анализе еды."""
import logging
from typing import Annotated, Optional

from pydantic import BaseModel, BeforeValidator, Field

logger = logging.getLogger(__name__)


def _to_float(v):
    """Преобразовать строки в числа и ограничить >= 0.

    AI может вернуть '100' вместо 100, или отрицательные значения.
    """
    if v is None:
        return None
    if isinstance(v, str):
        try:
            v = float(v)
        except ValueError:
            return None
    if isinstance(v, (int, float)):
        return max(0.0, float(v))  # Гарантируем >= 0
    return None


def _to_confidence(v):
    """Преобразовать confidence в int и ограничить 0-100."""
    if v is None:
        return None
    if isinstance(v, str):
        try:
            v = int(float(v))
        except ValueError:
            return None
    if isinstance(v, (int, float)):
        return max(0, min(100, int(v)))
    return None


# Annotated types для переиспользования валидаторов
# Проверки >= 0 и диапазонов выполняются в BeforeValidator, не в Field
# (Field constraints не работают с Optional + None в Pydantic v2)
NutritionFloat = Annotated[Optional[float], BeforeValidator(_to_float)]
ConfidenceInt = Annotated[Optional[int], BeforeValidator(_to_confidence)]


class FoodAnalysis(BaseModel):
    """Результат анализа еды от AI."""

    model_config = {'extra': 'ignore'}

    dish_name: str = 'Неизвестное блюдо'
    dish_type: Optional[str] = None
    calories: NutritionFloat = None
    proteins: NutritionFloat = None
    fats: NutritionFloat = None
    carbohydrates: NutritionFloat = None
    confidence: ConfidenceInt = None
    estimated_weight: NutritionFloat = None
    parse_error: bool = False


class Ingredient(BaseModel):
    """Ингредиент блюда."""

    model_config = {'extra': 'ignore'}

    name: str
    weight: NutritionFloat = None
    calories: NutritionFloat = None
    proteins: NutritionFloat = None
    fats: NutritionFloat = None
    carbohydrates: NutritionFloat = None
    is_ai_detected: bool = True


class SmartFoodAnalysis(FoodAnalysis):
    """Результат детального анализа еды с ингредиентами."""

    ingredients: list[Ingredient] = Field(default_factory=list)


def parse_food_analysis(data: dict) -> FoodAnalysis:
    """Безопасно распарсить данные анализа еды.

    Args:
        data: Словарь с данными от AI

    Returns:
        FoodAnalysis с валидированными данными
    """
    try:
        return FoodAnalysis(**data)
    except Exception as e:
        logger.warning(f'Failed to validate food analysis: {e}. Data: {data}')
        return FoodAnalysis(
            dish_name=data.get('dish_name', 'Неизвестное блюдо'),
            parse_error=True,
        )


def parse_smart_food_analysis(data: dict) -> SmartFoodAnalysis:
    """Безопасно распарсить данные детального анализа еды.

    Args:
        data: Словарь с данными от AI

    Returns:
        SmartFoodAnalysis с валидированными данными
    """
    try:
        return SmartFoodAnalysis(**data)
    except Exception as e:
        logger.warning(f'Failed to validate smart food analysis: {e}. Data: {data}')
        return SmartFoodAnalysis(
            dish_name=data.get('dish_name', 'Неизвестное блюдо'),
            parse_error=True,
        )
