from django.urls import path

from .client_views import ClientDailySummaryView, ClientMealListView, ClientReminderListView

urlpatterns = [
    path('meals/', ClientMealListView.as_view(), name='client_meals'),
    path('meals/daily/', ClientDailySummaryView.as_view(), name='client_daily_summary'),
    path('reminders/', ClientReminderListView.as_view(), name='client_reminders'),
]
