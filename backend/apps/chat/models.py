from django.db import models


class ChatMessage(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('voice', 'Voice'),
        ('photo', 'Photo'),
        ('audio', 'Audio'),
    ]

    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, default='text')
    content = models.TextField()
    visible_to_user = models.BooleanField(default=True)
    ai_response_id = models.CharField(max_length=100, blank=True)
    ai_provider = models.CharField(max_length=20, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    telegram_message_id = models.BigIntegerField(null=True, blank=True)
    read_by_coach = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_messages'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.role}] {self.content[:50]}'


class InteractionLog(models.Model):
    INTERACTION_TYPE_CHOICES = [
        ('text', 'Text'),
        ('vision', 'Vision'),
        ('voice', 'Voice'),
    ]

    client = models.ForeignKey('accounts.Client', on_delete=models.CASCADE, related_name='interaction_logs')
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='interaction_logs')
    interaction_type = models.CharField(max_length=10, choices=INTERACTION_TYPE_CHOICES)
    client_input = models.TextField()
    ai_request = models.JSONField(default=dict)
    ai_response = models.JSONField(default=dict)
    client_output = models.TextField()
    provider = models.CharField(max_length=30)
    model = models.CharField(max_length=100)
    duration_ms = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'interaction_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.interaction_type}] {self.client} @ {self.created_at}'
