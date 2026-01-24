from django.urls import path
from . import webhook

urlpatterns = [
    path('webhook/', webhook.telegram_webhook, name='telegram_webhook'),
]
