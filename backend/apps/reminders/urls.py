from django.urls import path

from . import views

urlpatterns = [
    path('', views.ReminderListView.as_view(), name='reminder_list'),
    path('<int:pk>/', views.ReminderDetailView.as_view(), name='reminder_detail'),
    path('<int:pk>/test/', views.ReminderTestView.as_view(), name='reminder_test'),
    path('generate-text/', views.ReminderGenerateTextView.as_view(), name='reminder_generate_text'),
    path('context-blocks/', views.ContextBlocksView.as_view(), name='reminder_context_blocks'),
]
