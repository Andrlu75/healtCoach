from django.db import models


CONTEXT_BLOCKS = [
    {'id': 'greeting', 'label': 'Приветствие', 'description': 'Персональное приветствие'},
    {'id': 'weather', 'label': 'Погода', 'description': 'Прогноз погоды по городу клиента'},
    {'id': 'meal_plan', 'label': 'План питания', 'description': 'Приёмы пищи на сегодня по программе'},
    {'id': 'workout_plan', 'label': 'План тренировки', 'description': 'Тренировки на сегодня'},
    {'id': 'sport_tip', 'label': 'Совет по спорту', 'description': 'Полезный совет по тренировкам'},
    {'id': 'nutrition_tip', 'label': 'Совет по питанию', 'description': 'Полезный совет по питанию'},
    {'id': 'motivation', 'label': 'Мотивация', 'description': 'Мотивирующая фраза на день'},
    {'id': 'metrics_summary', 'label': 'Показатели', 'description': 'Последние метрики (вес, шаги)'},
]


class Reminder(models.Model):
    FREQUENCY_CHOICES = [
        ('once', 'Однократно'),
        ('daily', 'Ежедневно'),
        ('weekly', 'Еженедельно'),
        ('custom', 'Настраиваемый'),
    ]
    TYPE_CHOICES = [
        ('morning', 'Утреннее приветствие'),
        ('meal_program', 'Приём пищи (программа)'),
        ('meal', 'Приём пищи'),
        ('water', 'Вода'),
        ('workout', 'Тренировка'),
        ('weigh_in', 'Взвешивание'),
        ('event', 'По событию'),
        ('custom', 'Другое'),
    ]
    TRIGGER_EVENT_CHOICES = [
        ('workout_completed', 'Завершение тренировки'),
    ]

    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='reminders')
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='created_reminders')
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    reminder_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='custom')
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='daily')
    time = models.TimeField(null=True, blank=True)
    days_of_week = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    is_smart = models.BooleanField(default=False)

    # Утреннее приветствие: список контекстных блоков
    context_blocks = models.JSONField(default=list, blank=True)

    # Напоминание о приёме пищи по программе: за сколько минут до приёма
    offset_minutes = models.IntegerField(default=30)

    # По событию: тип события и задержка
    trigger_event = models.CharField(max_length=30, choices=TRIGGER_EVENT_CHOICES, blank=True, default='')
    trigger_delay_minutes = models.IntegerField(default=30)

    # Промпт для AI-генерации текста (коуч может задать свой шаблон)
    generation_prompt = models.TextField(blank=True, default='')

    last_sent_at = models.DateTimeField(null=True, blank=True)
    next_fire_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reminders'

    def __str__(self):
        return f'{self.title} ({self.client})'
