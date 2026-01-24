from django.db import models


class BotPersona(models.Model):
    coach = models.OneToOneField('accounts.Coach', on_delete=models.CASCADE, related_name='bot_persona')
    name = models.CharField(max_length=100, default='\u0424\u0451\u0434\u043e\u0440')
    age = models.IntegerField(null=True, blank=True)
    city = models.CharField(max_length=100, blank=True)
    style_description = models.TextField(blank=True)
    system_prompt = models.TextField(default='')
    greeting_message = models.TextField(blank=True)

    # AI settings — separate models for text/vision/voice
    text_provider = models.CharField(max_length=20, blank=True)
    text_model = models.CharField(max_length=100, blank=True)
    vision_provider = models.CharField(max_length=20, blank=True)
    vision_model = models.CharField(max_length=100, blank=True)
    voice_provider = models.CharField(max_length=20, blank=True)
    voice_model = models.CharField(max_length=100, blank=True)

    temperature = models.FloatField(default=0.7)
    max_tokens = models.IntegerField(default=600)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bot_personas'

    def __str__(self):
        return f'{self.name} ({self.coach})'


class AIProviderConfig(models.Model):
    PROVIDER_CHOICES = [
        ('openai', 'OpenAI'),
        ('anthropic', 'Anthropic'),
        ('deepseek', 'DeepSeek'),
        ('gemini', 'Gemini'),
    ]

    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='ai_providers')
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    api_key = models.CharField(max_length=300)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_provider_configs'
        unique_together = ['coach', 'provider']

    def __str__(self):
        return f'{self.coach} - {self.provider}'

    @property
    def masked_key(self):
        if len(self.api_key) > 8:
            return self.api_key[:4] + '...' + self.api_key[-4:]
        return '****'


class AIModelConfig(models.Model):
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='ai_models')
    provider = models.CharField(max_length=20)  # openai, anthropic, deepseek, gemini
    model_id = models.CharField(max_length=100)  # gpt-4o, claude-sonnet-4-20250514, etc.
    model_name = models.CharField(max_length=150)  # Human-readable name
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_model_configs'
        unique_together = ['coach', 'provider', 'model_id']

    def __str__(self):
        return f'{self.coach} - {self.provider}/{self.model_id}'


class TelegramBot(models.Model):
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='telegram_bots')
    name = models.CharField(max_length=100)  # "Тестовый", "Продуктивный"
    token = models.CharField(max_length=100)
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'telegram_bots'

    def __str__(self):
        return f'{self.name} ({self.coach})'

    @property
    def masked_token(self):
        if len(self.token) > 10:
            return self.token[:4] + '...' + self.token[-4:]
        return '****'


class AIUsageLog(models.Model):
    TASK_TYPE_CHOICES = [
        ('text', 'Text'),
        ('vision', 'Vision'),
        ('voice', 'Voice'),
    ]

    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='ai_usage')
    client = models.ForeignKey('accounts.Client', null=True, blank=True, on_delete=models.SET_NULL)
    provider = models.CharField(max_length=20)
    model = models.CharField(max_length=100)
    task_type = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES)
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_usage_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.provider}/{self.model} - {self.task_type} ({self.created_at})'
