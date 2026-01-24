from django.db import models


class Reminder(models.Model):
    FREQUENCY_CHOICES = [
        ('once', 'Однократно'),
        ('daily', 'Ежедневно'),
        ('weekly', 'Еженедельно'),
        ('custom', 'Настраиваемый'),
    ]
    TYPE_CHOICES = [
        ('meal', 'Приём пищи'),
        ('water', 'Вода'),
        ('workout', 'Тренировка'),
        ('weigh_in', 'Взвешивание'),
        ('custom', 'Другое'),
    ]

    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='reminders')
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='created_reminders')
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    reminder_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='meal')
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='daily')
    time = models.TimeField()
    days_of_week = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    is_smart = models.BooleanField(default=False)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    next_fire_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reminders'

    def __str__(self):
        return f'{self.title} ({self.client})'
