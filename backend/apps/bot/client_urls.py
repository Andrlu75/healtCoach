from django.urls import path

from .client_views import (
    ClientDailySummaryView,
    ClientMealAnalyzeView,
    ClientMealDetailView,
    ClientMealListView,
    ClientMealRecalculateView,
    ClientOnboardingQuestionsView,
    ClientOnboardingSubmitView,
    ClientProfileView,
    ClientReminderListView,
)

urlpatterns = [
    path('meals/', ClientMealListView.as_view(), name='client_meals'),
    path('meals/daily/', ClientDailySummaryView.as_view(), name='client_daily_summary'),
    path('meals/analyze/', ClientMealAnalyzeView.as_view(), name='client_meal_analyze'),
    path('meals/recalculate/', ClientMealRecalculateView.as_view(), name='client_meal_recalculate'),
    path('meals/<int:pk>/', ClientMealDetailView.as_view(), name='client_meal_detail'),
    path('profile/', ClientProfileView.as_view(), name='client_profile'),
    path('reminders/', ClientReminderListView.as_view(), name='client_reminders'),
    path('onboarding/questions/', ClientOnboardingQuestionsView.as_view(), name='client_onboarding_questions'),
    path('onboarding/submit/', ClientOnboardingSubmitView.as_view(), name='client_onboarding_submit'),
]
