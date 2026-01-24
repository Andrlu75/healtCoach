from django.urls import path

from . import views

urlpatterns = [
    path('', views.ReminderListView.as_view(), name='reminder_list'),
    path('<int:pk>/', views.ReminderDetailView.as_view(), name='reminder_detail'),
]
