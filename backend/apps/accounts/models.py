from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('coach', 'Coach'),
        ('client', 'Client'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='coach')

    class Meta:
        db_table = 'users'


class Coach(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='coach_profile')
    telegram_user_id = models.BigIntegerField(unique=True, null=True, blank=True)
    business_name = models.CharField(max_length=200, blank=True)
    timezone = models.CharField(max_length=50, default='Europe/Moscow')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'coaches'

    def __str__(self):
        return self.business_name or self.user.get_full_name() or self.user.username


class Client(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Ожидает'),
        ('active', 'Активный'),
        ('paused', 'Пауза'),
        ('archived', 'Архив'),
    ]

    coach = models.ForeignKey(Coach, on_delete=models.CASCADE, related_name='clients')
    telegram_user_id = models.BigIntegerField(unique=True)
    telegram_username = models.CharField(max_length=100, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    timezone = models.CharField(max_length=50, default='Europe/Moscow')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    # Персональные нормы КБЖУ
    daily_calories = models.IntegerField(null=True, blank=True)
    daily_proteins = models.FloatField(null=True, blank=True)
    daily_fats = models.FloatField(null=True, blank=True)
    daily_carbs = models.FloatField(null=True, blank=True)
    daily_water = models.FloatField(null=True, blank=True)  # литры

    # Онбординг
    onboarding_completed = models.BooleanField(default=False)
    onboarding_data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'clients'

    def __str__(self):
        return f'{self.first_name} {self.last_name}'.strip() or str(self.telegram_user_id)
