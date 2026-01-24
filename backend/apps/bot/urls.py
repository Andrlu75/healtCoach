from django.urls import path
from . import webhook

urlpatterns = [
    path('webhook/<int:bot_id>/', webhook.telegram_webhook, name='telegram_webhook'),
]
