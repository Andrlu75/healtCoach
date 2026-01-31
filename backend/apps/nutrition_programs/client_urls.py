from django.urls import path

from .client_views import (
    NutritionProgramHistoryView,
    NutritionProgramSummaryView,
    NutritionProgramTodayView,
    NutritionProgramViolationsView,
)

urlpatterns = [
    path('today/', NutritionProgramTodayView.as_view(), name='nutrition_program_today'),
    path('history/', NutritionProgramHistoryView.as_view(), name='nutrition_program_history'),
    path('violations/', NutritionProgramViolationsView.as_view(), name='nutrition_program_violations'),
    path('summary/', NutritionProgramSummaryView.as_view(), name='nutrition_program_summary'),
]
