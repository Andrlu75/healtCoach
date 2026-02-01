from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

# Router для ViewSets базы блюд
router = DefaultRouter()
router.register(r'dishes', views.DishViewSet, basename='dish')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'dish-tags', views.DishTagViewSet, basename='dishtag')

urlpatterns = [
    # Существующие API для meals
    path('', views.MealListView.as_view(), name='meal_list'),
    path('daily/', views.DailySummaryView.as_view(), name='daily_summary'),
    path('dashboard/', views.TodayMealsDashboardView.as_view(), name='meals_dashboard'),

    # Умный режим - черновики
    path('drafts/<uuid:draft_id>/', views.MealDraftDetailView.as_view(), name='draft_detail'),
    path('drafts/<uuid:draft_id>/confirm/', views.MealDraftConfirmView.as_view(), name='draft_confirm'),
    path('drafts/<uuid:draft_id>/ingredients/', views.MealDraftAddIngredientView.as_view(), name='draft_add_ingredient'),
    path('drafts/<uuid:draft_id>/ingredients/<int:index>/', views.MealDraftRemoveIngredientView.as_view(), name='draft_remove_ingredient'),

    # AI API endpoints
    path('ai/generate-recipe/', views.DishAIGenerateRecipeView.as_view(), name='ai_generate_recipe'),
    path('ai/calculate-nutrition/', views.DishAICalculateNutritionView.as_view(), name='ai_calculate_nutrition'),
    path('ai/suggest-description/', views.DishAISuggestDescriptionView.as_view(), name='ai_suggest_description'),
    path('ai/suggest-product-nutrition/', views.ProductAISuggestNutritionView.as_view(), name='ai_suggest_product_nutrition'),

    # ViewSets для базы блюд (dishes, products, dish-tags)
    path('', include(router.urls)),
]
