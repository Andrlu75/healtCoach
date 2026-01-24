import uuid

from django.db import models


class InviteLink(models.Model):
    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='invite_links')
    code = models.CharField(max_length=32, unique=True, default=uuid.uuid4)
    is_active = models.BooleanField(default=True)
    max_uses = models.IntegerField(default=1)
    uses_count = models.IntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'invite_links'

    def __str__(self):
        return f'Invite {self.code[:8]}... ({self.coach})'


class OnboardingQuestion(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('text', 'Текст'),
        ('number', 'Число'),
        ('choice', 'Выбор'),
        ('multi_choice', 'Множественный выбор'),
        ('date', 'Дата'),
    ]

    coach = models.ForeignKey('accounts.Coach', on_delete=models.CASCADE, related_name='onboarding_questions')
    text = models.TextField()
    question_type = models.CharField(max_length=15, choices=QUESTION_TYPE_CHOICES)
    options = models.JSONField(default=list, blank=True)
    is_required = models.BooleanField(default=True)
    order = models.IntegerField(default=0)
    field_key = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'onboarding_questions'
        ordering = ['order']

    def __str__(self):
        return self.text[:50]
