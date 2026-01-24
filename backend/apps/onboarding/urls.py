from django.urls import path

from . import views

urlpatterns = [
    path('invites/', views.InviteLinkListView.as_view(), name='invite_list'),
    path('invites/<int:pk>/', views.InviteLinkDeleteView.as_view(), name='invite_delete'),
    path('questions/', views.OnboardingQuestionListView.as_view(), name='question_list'),
    path('questions/<int:pk>/', views.OnboardingQuestionDetailView.as_view(), name='question_detail'),
]
