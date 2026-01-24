from django.urls import path
from .views import BotPersonaView, AISettingsView, TelegramSettingsView, DashboardStatsView

urlpatterns = [
    path('', BotPersonaView.as_view(), name='bot_persona'),
    path('ai/', AISettingsView.as_view(), name='ai_settings'),
    path('telegram/', TelegramSettingsView.as_view(), name='telegram_settings'),
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard_stats'),
]
