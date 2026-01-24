from django.urls import path

from . import views

urlpatterns = [
    path('messages/', views.ChatMessageListView.as_view(), name='chat_messages'),
]
