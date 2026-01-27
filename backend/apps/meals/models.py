from io import BytesIO

from django.core.files.base import ContentFile
from django.db import models
from PIL import Image


class Meal(models.Model):
    IMAGE_TYPE_CHOICES = [
        ('food', 'Еда'),
        ('data', 'Цифровые данные'),
        ('other', 'Прочее'),
    ]

    THUMBNAIL_SIZE = (300, 300)

    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='meals')
    image = models.ImageField(upload_to='meals/%Y/%m/%d/', blank=True)
    thumbnail = models.ImageField(upload_to='meals/thumbnails/%Y/%m/%d/', blank=True)
    image_type = models.CharField(max_length=10, choices=IMAGE_TYPE_CHOICES, default='food')

    dish_name = models.CharField(max_length=200)
    dish_type = models.CharField(max_length=50, blank=True)
    calories = models.FloatField(null=True, blank=True)
    proteins = models.FloatField(null=True, blank=True)
    fats = models.FloatField(null=True, blank=True)
    carbohydrates = models.FloatField(null=True, blank=True)

    ingredients = models.JSONField(default=list, blank=True)
    health_analysis = models.JSONField(default=dict, blank=True)
    ai_confidence = models.IntegerField(null=True, blank=True)

    plate_type = models.CharField(max_length=100, blank=True)
    layout = models.CharField(max_length=200, blank=True)
    decorations = models.CharField(max_length=200, blank=True)

    meal_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meals'
        ordering = ['-meal_time']

    def __str__(self):
        return f'{self.dish_name} ({self.client})'

    def save(self, *args, **kwargs):
        # Generate thumbnail if image exists and thumbnail doesn't
        if self.image and not self.thumbnail:
            self._create_thumbnail()
        super().save(*args, **kwargs)

    def _create_thumbnail(self):
        """Create a thumbnail from the main image."""
        try:
            img = Image.open(self.image)

            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Resize maintaining aspect ratio
            img.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

            # Save to BytesIO
            thumb_io = BytesIO()
            img.save(thumb_io, format='JPEG', quality=85)
            thumb_io.seek(0)

            # Generate thumbnail filename
            thumb_name = f"thumb_{self.image.name.split('/')[-1].rsplit('.', 1)[0]}.jpg"

            # Save to thumbnail field
            self.thumbnail.save(thumb_name, ContentFile(thumb_io.read()), save=False)
        except Exception:
            # If thumbnail creation fails, just continue without it
            pass
