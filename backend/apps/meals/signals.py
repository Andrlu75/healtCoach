"""Django signals для приложения meals.

Автоматические действия при сохранении/изменении моделей:
- Генерация миниатюр при загрузке фото блюда
- Пересчёт КБЖУ блюд при изменении продукта
"""

import logging

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.meals.models import Dish, Product

logger = logging.getLogger(__name__)


# ============================================================================
# DISH SIGNALS
# ============================================================================

@receiver(pre_save, sender=Dish)
def track_photo_change(sender, instance: Dish, **kwargs) -> None:
    """Отслеживает изменение фото блюда.

    Сохраняет предыдущее значение photo для сравнения в post_save.
    """
    if instance.pk:
        try:
            old_instance = Dish.objects.get(pk=instance.pk)
            instance._old_photo = old_instance.photo.name if old_instance.photo else None
        except Dish.DoesNotExist:
            instance._old_photo = None
    else:
        instance._old_photo = None


@receiver(post_save, sender=Dish)
def generate_thumbnail_on_photo_change(sender, instance: Dish, created: bool, **kwargs) -> None:
    """Запускает генерацию миниатюры при изменении фото.

    Триггерится только если:
    - Это новое блюдо с фото
    - Или фото было изменено (старое != новое)
    """
    if not instance.photo:
        return

    current_photo = instance.photo.name

    # Проверяем, изменилось ли фото
    old_photo = getattr(instance, '_old_photo', None)
    photo_changed = created or (current_photo != old_photo)

    if photo_changed:
        try:
            from apps.meals.tasks import generate_dish_thumbnail

            # Запускаем таск асинхронно
            generate_dish_thumbnail.delay(instance.pk)
            logger.info(f'Scheduled thumbnail generation for dish {instance.pk}')

        except Exception as e:
            # Не блокируем сохранение при ошибке очереди
            logger.warning(
                f'Failed to schedule thumbnail generation for dish {instance.pk}: {e}'
            )


# ============================================================================
# PRODUCT SIGNALS
# ============================================================================

@receiver(pre_save, sender=Product)
def track_nutrition_change(sender, instance: Product, **kwargs) -> None:
    """Отслеживает изменение КБЖУ продукта.

    Сохраняет предыдущие значения для сравнения в post_save.
    """
    if instance.pk:
        try:
            old_instance = Product.objects.get(pk=instance.pk)
            instance._old_nutrition = {
                'calories': old_instance.calories_per_100g,
                'proteins': old_instance.proteins_per_100g,
                'fats': old_instance.fats_per_100g,
                'carbs': old_instance.carbs_per_100g,
            }
        except Product.DoesNotExist:
            instance._old_nutrition = None
    else:
        instance._old_nutrition = None


@receiver(post_save, sender=Product)
def recalculate_dishes_on_nutrition_change(
    sender, instance: Product, created: bool, **kwargs
) -> None:
    """Пересчитывает КБЖУ блюд при изменении КБЖУ продукта.

    Триггерится только если КБЖУ действительно изменилось.
    """
    if created:
        # Новый продукт ещё не используется в блюдах
        return

    old_nutrition = getattr(instance, '_old_nutrition', None)

    if old_nutrition is None:
        return

    # Проверяем, изменилось ли КБЖУ
    nutrition_changed = (
        old_nutrition['calories'] != instance.calories_per_100g
        or old_nutrition['proteins'] != instance.proteins_per_100g
        or old_nutrition['fats'] != instance.fats_per_100g
        or old_nutrition['carbs'] != instance.carbs_per_100g
    )

    if nutrition_changed:
        try:
            from apps.meals.tasks import recalculate_dishes_nutrition

            # Запускаем таск асинхронно
            recalculate_dishes_nutrition.delay(instance.pk)
            logger.info(
                f'Scheduled dishes nutrition recalculation for product {instance.pk}'
            )

        except Exception as e:
            # Не блокируем сохранение при ошибке очереди
            logger.warning(
                f'Failed to schedule nutrition recalculation for product {instance.pk}: {e}'
            )
