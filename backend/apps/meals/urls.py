from django.urls import path

from . import views

urlpatterns = [
    path('', views.MealListView.as_view(), name='meal_list'),
    path('daily/', views.DailySummaryView.as_view(), name='daily_summary'),
]
