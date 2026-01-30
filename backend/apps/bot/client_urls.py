from django.urls import include, path

from .client_views import (
    ClientDailySummaryView,
    ClientMealAnalyzeView,
    ClientMealAnalyzeSmartView,
    ClientMealDetailView,
    ClientMealDraftAddIngredientView,
    ClientMealDraftConfirmView,
    ClientMealDraftDetailView,
    ClientMealDraftRemoveIngredientView,
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

    # Умный режим
    path('meals/analyze-smart/', ClientMealAnalyzeSmartView.as_view(), name='client_meal_analyze_smart'),
    path('meals/drafts/<uuid:draft_id>/', ClientMealDraftDetailView.as_view(), name='client_draft_detail'),
    path('meals/drafts/<uuid:draft_id>/confirm/', ClientMealDraftConfirmView.as_view(), name='client_draft_confirm'),
    path('meals/drafts/<uuid:draft_id>/ingredients/', ClientMealDraftAddIngredientView.as_view(), name='client_draft_add_ingredient'),
    path('meals/drafts/<uuid:draft_id>/ingredients/<int:index>/', ClientMealDraftRemoveIngredientView.as_view(), name='client_draft_remove_ingredient'),

    path('profile/', ClientProfileView.as_view(), name='client_profile'),
    path('reminders/', ClientReminderListView.as_view(), name='client_reminders'),
    path('onboarding/questions/', ClientOnboardingQuestionsView.as_view(), name='client_onboarding_questions'),
    path('onboarding/submit/', ClientOnboardingSubmitView.as_view(), name='client_onboarding_submit'),

    # Integrations
    path('integrations/', include('apps.integrations.client_urls')),
]
