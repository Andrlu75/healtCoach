from django.urls import path

from .client_views import (
    ClientDailySummaryView,
    ClientMealAnalyzeView,
    ClientMealDetailView,
    ClientMealListView,
    ClientReminderListView,
)

urlpatterns = [
    path('meals/', ClientMealListView.as_view(), name='client_meals'),
    path('meals/daily/', ClientDailySummaryView.as_view(), name='client_daily_summary'),
    path('meals/analyze/', ClientMealAnalyzeView.as_view(), name='client_meal_analyze'),
    path('meals/<int:pk>/', ClientMealDetailView.as_view(), name='client_meal_detail'),
    path('reminders/', ClientReminderListView.as_view(), name='client_reminders'),
]
