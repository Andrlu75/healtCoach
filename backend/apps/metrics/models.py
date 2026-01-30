from django.db import models


class HealthMetric(models.Model):
    METRIC_TYPE_CHOICES = [
        ('weight', 'Вес'),
        ('sleep', 'Сон'),
        ('steps', 'Шаги'),
        ('heart_rate', 'Пульс'),
        ('blood_pressure', 'Давление'),
        ('water', 'Вода'),
        ('active_calories', 'Калории активности'),
        ('custom', 'Другое'),
    ]
    SOURCE_CHOICES = [
        ('manual', 'Вручную'),
        ('photo', 'Фото'),
        ('fitness_tracker', 'Трекер'),
    ]

    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='health_metrics')
    metric_type = models.CharField(max_length=20, choices=METRIC_TYPE_CHOICES)
    value = models.FloatField()
    unit = models.CharField(max_length=20)
    notes = models.TextField(blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
    recorded_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'health_metrics'
        ordering = ['-recorded_at']

    def __str__(self):
        return f'{self.client} - {self.metric_type}: {self.value}{self.unit}'
