from django.urls import path

from . import views

urlpatterns = [
    path('', views.MealListView.as_view(), name='meal_list'),
    path('daily/', views.DailySummaryView.as_view(), name='daily_summary'),
    path('dashboard/', views.TodayMealsDashboardView.as_view(), name='meals_dashboard'),

    # Умный режим - черновики
    path('drafts/<uuid:draft_id>/', views.MealDraftDetailView.as_view(), name='draft_detail'),
    path('drafts/<uuid:draft_id>/confirm/', views.MealDraftConfirmView.as_view(), name='draft_confirm'),
    path('drafts/<uuid:draft_id>/ingredients/', views.MealDraftAddIngredientView.as_view(), name='draft_add_ingredient'),
    path('drafts/<uuid:draft_id>/ingredients/<int:index>/', views.MealDraftRemoveIngredientView.as_view(), name='draft_remove_ingredient'),
]
