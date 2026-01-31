"""Валидаторы для загрузки файлов."""
from django.core.exceptions import ValidationError
from PIL import Image
import io


# Дефолтный максимальный размер загружаемого изображения (10 МБ)
DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024

# Разрешённые MIME-типы для изображений
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}

# Разрешённые расширения
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}


def get_max_image_size() -> int:
    """Получает максимальный размер изображения из settings (lazy)."""
    from django.conf import settings
    return getattr(settings, 'MAX_IMAGE_UPLOAD_SIZE', DEFAULT_MAX_IMAGE_SIZE)


def validate_image_size(file) -> None:
    """Проверяет что размер файла не превышает лимит."""
    max_size = get_max_image_size()
    if file.size > max_size:
        max_mb = max_size / (1024 * 1024)
        raise ValidationError(
            f'Размер файла превышает максимально допустимый ({max_mb:.0f} МБ)'
        )


def validate_image_content_type(file) -> None:
    """Проверяет MIME-тип файла."""
    content_type = getattr(file, 'content_type', None)
    if content_type and content_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(
            f'Недопустимый тип файла: {content_type}. '
            f'Разрешены: JPEG, PNG, GIF, WebP'
        )


def validate_image_extension(file) -> None:
    """Проверяет расширение файла."""
    import os
    name = getattr(file, 'name', '')
    if name:
        ext = os.path.splitext(name)[1].lower()
        if ext and ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise ValidationError(
                f'Недопустимое расширение файла: {ext}. '
                f'Разрешены: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'
            )


def validate_image_is_valid(file) -> None:
    """Проверяет что файл является валидным изображением через PIL."""
    try:
        # Сохраняем позицию
        pos = file.tell() if hasattr(file, 'tell') else 0

        # Читаем данные для проверки
        file.seek(0)
        data = file.read()
        file.seek(pos)  # Возвращаем позицию

        # Проверяем через PIL
        img = Image.open(io.BytesIO(data))
        img.verify()  # Проверяет целостность без полной загрузки

    except Exception:
        raise ValidationError('Файл не является валидным изображением')


def validate_uploaded_image(file) -> None:
    """Комплексная валидация загружаемого изображения."""
    validate_image_size(file)
    validate_image_content_type(file)
    validate_image_extension(file)
    validate_image_is_valid(file)


def validate_image_data(data: bytes, max_size: int = None) -> None:
    """Валидация бинарных данных изображения (для API views)."""
    max_size = max_size or get_max_image_size()

    if len(data) > max_size:
        max_mb = max_size / (1024 * 1024)
        raise ValidationError(
            f'Размер файла превышает максимально допустимый ({max_mb:.0f} МБ)'
        )

    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
    except Exception:
        raise ValidationError('Файл не является валидным изображением')
