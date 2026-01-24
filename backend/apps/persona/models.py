from django.db import models


class BotPersona(models.Model):
    coach = models.OneToOneField('accounts.Coach', on_delete=models.CASCADE, related_name='bot_persona')
    name = models.CharField(max_length=100, default='Фёдор')
    age = models.IntegerField(null=True, blank=True)
    city = models.CharField(max_length=100, blank=True)
    style_description = models.TextField(blank=True)
    system_prompt = models.TextField(default='')
    greeting_message = models.TextField(blank=True)

    # AI settings
    ai_provider = models.CharField(max_length=20, default='openai')
    ai_model_chat = models.CharField(max_length=50, default='gpt-4o-mini')
    ai_model_vision = models.CharField(max_length=50, default='gpt-4o')
    temperature = models.FloatField(default=0.7)
    max_tokens = models.IntegerField(default=600)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bot_personas'

    def __str__(self):
        return f'{self.name} ({self.coach})'
