"""Celery tasks для приложения meals.

Асинхронные задачи для обработки изображений и пересчёта КБЖУ.
"""

import logging
from io import BytesIO
from pathlib import Path

from celery import shared_task
from django.core.files.base import ContentFile
from PIL import Image

logger = logging.getLogger(__name__)

# Размер миниатюры
THUMBNAIL_SIZE = (300, 300)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_dish_thumbnail(self, dish_id: int) -> dict:
    """Генерирует миниатюру для фото блюда.

    Создаёт миниатюру 300x300 пикселей с сохранением пропорций
    и белым фоном для квадратного изображения.

    Args:
        dish_id: ID блюда для обработки

    Returns:
        dict: Результат операции с путём к миниатюре или ошибкой

    Raises:
        Retry: При временных ошибках (файл не найден, etc.)
    """
    from apps.meals.models import Dish

    try:
        dish = Dish.objects.get(pk=dish_id)
    except Dish.DoesNotExist:
        logger.warning(f'Dish {dish_id} not found, skipping thumbnail generation')
        return {'status': 'error', 'message': f'Dish {dish_id} not found'}

    if not dish.photo:
        logger.info(f'Dish {dish_id} has no photo, skipping thumbnail generation')
        return {'status': 'skipped', 'message': 'No photo'}

    try:
        # Открываем исходное изображение
        with dish.photo.open('rb') as f:
            img = Image.open(f)
            img = img.convert('RGB')  # Конвертируем в RGB для JPEG

            # Создаём миниатюру с сохранением пропорций
            img.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

            # Создаём квадратное изображение с белым фоном
            thumb = Image.new('RGB', THUMBNAIL_SIZE, (255, 255, 255))

            # Центрируем миниатюру
            offset = (
                (THUMBNAIL_SIZE[0] - img.size[0]) // 2,
                (THUMBNAIL_SIZE[1] - img.size[1]) // 2,
            )
            thumb.paste(img, offset)

            # Сохраняем в буфер
            buffer = BytesIO()
            thumb.save(buffer, format='JPEG', quality=85, optimize=True)
            buffer.seek(0)

            # Генерируем имя файла
            original_name = Path(dish.photo.name).stem
            thumb_name = f'{original_name}_thumb.jpg'

            # Сохраняем миниатюру
            dish.thumbnail.save(thumb_name, ContentFile(buffer.read()), save=True)

            logger.info(f'Generated thumbnail for dish {dish_id}: {dish.thumbnail.name}')

            return {
                'status': 'success',
                'dish_id': dish_id,
                'thumbnail': dish.thumbnail.name,
            }

    except FileNotFoundError as e:
        logger.error(f'Photo file not found for dish {dish_id}: {e}')
        # Retry в случае если файл ещё не синхронизирован
        raise self.retry(exc=e)

    except Exception as e:
        logger.exception(f'Error generating thumbnail for dish {dish_id}: {e}')
        return {'status': 'error', 'message': str(e)}


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def recalculate_dishes_nutrition(self, product_id: int) -> dict:
    """Пересчитывает КБЖУ всех блюд, содержащих указанный продукт.

    Вызывается при изменении КБЖУ продукта. Находит все блюда,
    где продукт используется как ингредиент, и пересчитывает
    их КБЖУ на основе обновлённых данных продукта.

    Args:
        product_id: ID продукта, КБЖУ которого изменилось

    Returns:
        dict: Результат с количеством обновлённых блюд
    """
    from decimal import Decimal
    from apps.meals.models import Dish, Product

    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        logger.warning(f'Product {product_id} not found')
        return {'status': 'error', 'message': f'Product {product_id} not found'}

    # Находим все блюда этого коуча с данным продуктом в ингредиентах
    dishes = Dish.objects.filter(
        coach=product.coach,
        ingredients__contains=[{'product_id': product_id}],
    )

    updated_count = 0

    for dish in dishes:
        try:
            # Обновляем КБЖУ ингредиентов на основе продукта
            updated_ingredients = []
            needs_update = False

            for ing in dish.ingredients:
                if ing.get('product_id') == product_id:
                    # Пересчитываем КБЖУ для этого ингредиента
                    weight = Decimal(str(ing.get('weight', 0)))
                    multiplier = weight / Decimal('100')

                    new_ing = {
                        **ing,
                        'calories': float(round(product.calories_per_100g * multiplier, 2)),
                        'proteins': float(round(product.proteins_per_100g * multiplier, 2)),
                        'fats': float(round(product.fats_per_100g * multiplier, 2)),
                        'carbohydrates': float(round(product.carbs_per_100g * multiplier, 2)),
                    }
                    updated_ingredients.append(new_ing)
                    needs_update = True
                else:
                    updated_ingredients.append(ing)

            if needs_update:
                dish.ingredients = updated_ingredients
                dish.recalculate_nutrition()
                dish.save(update_fields=[
                    'ingredients',
                    'portion_weight',
                    'calories',
                    'proteins',
                    'fats',
                    'carbohydrates',
                    'updated_at',
                ])
                updated_count += 1
                logger.info(f'Updated nutrition for dish {dish.id}')

        except Exception as e:
            logger.exception(f'Error updating dish {dish.id}: {e}')
            continue

    logger.info(
        f'Recalculated nutrition for {updated_count} dishes '
        f'after product {product_id} update'
    )

    return {
        'status': 'success',
        'product_id': product_id,
        'updated_dishes_count': updated_count,
    }


@shared_task
def cleanup_orphaned_thumbnails() -> dict:
    """Удаляет миниатюры для удалённых блюд.

    Периодическая задача для очистки storage от
    осиротевших файлов миниатюр.

    Returns:
        dict: Результат с количеством удалённых файлов
    """
    from django.core.files.storage import default_storage
    from apps.meals.models import Dish

    # Получаем все существующие миниатюры
    existing_thumbnails = set(
        Dish.objects.exclude(thumbnail='').values_list('thumbnail', flat=True)
    )

    deleted_count = 0

    # Проверяем файлы в директории thumbnails
    try:
        dirs, files = default_storage.listdir('dishes/thumbnails')

        for year_dir in dirs:
            year_path = f'dishes/thumbnails/{year_dir}'
            _, month_dirs = default_storage.listdir(year_path)

            for month_dir in month_dirs:
                month_path = f'{year_path}/{month_dir}'
                _, thumb_files = default_storage.listdir(month_path)

                for thumb_file in thumb_files:
                    thumb_path = f'{month_path}/{thumb_file}'

                    if thumb_path not in existing_thumbnails:
                        try:
                            default_storage.delete(thumb_path)
                            deleted_count += 1
                            logger.info(f'Deleted orphaned thumbnail: {thumb_path}')
                        except Exception as e:
                            logger.warning(f'Failed to delete {thumb_path}: {e}')

    except Exception as e:
        logger.exception(f'Error during thumbnail cleanup: {e}')
        return {'status': 'error', 'message': str(e)}

    logger.info(f'Cleaned up {deleted_count} orphaned thumbnails')

    return {
        'status': 'success',
        'deleted_count': deleted_count,
    }
