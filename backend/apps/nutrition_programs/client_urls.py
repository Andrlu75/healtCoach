from django.urls import path

from .client_views import (
    MealReportCreateView,
    MealReportPhotoView,
    MealReportsListView,
    NutritionProgramHistoryView,
    NutritionProgramSummaryView,
    NutritionProgramTodayView,
    NutritionProgramViolationsView,
    ShoppingListView,
)

urlpatterns = [
    path('today/', NutritionProgramTodayView.as_view(), name='nutrition_program_today'),
    path('history/', NutritionProgramHistoryView.as_view(), name='nutrition_program_history'),
    path('violations/', NutritionProgramViolationsView.as_view(), name='nutrition_program_violations'),
    path('summary/', NutritionProgramSummaryView.as_view(), name='nutrition_program_summary'),
    path('meal-report/', MealReportCreateView.as_view(), name='meal_report_create'),
    path('meal-report/<int:report_id>/photo/', MealReportPhotoView.as_view(), name='meal_report_photo'),
    path('meal-reports/', MealReportsListView.as_view(), name='meal_reports_list'),
    path('shopping-list/', ShoppingListView.as_view(), name='shopping_list'),
]
