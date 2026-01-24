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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_messages'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.role}] {self.content[:50]}'
