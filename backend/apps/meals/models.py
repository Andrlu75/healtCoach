from django.db import models


class Meal(models.Model):
    IMAGE_TYPE_CHOICES = [
        ('food', 'Еда'),
        ('data', 'Цифровые данные'),
        ('other', 'Прочее'),
    ]

    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='meals')
    image = models.ImageField(upload_to='meals/%Y/%m/%d/', blank=True)
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
