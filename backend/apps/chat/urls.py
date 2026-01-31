from django.urls import path

from . import views

urlpatterns = [
    path('messages/', views.ChatMessageListView.as_view(), name='chat_messages'),
    path('send/', views.CoachSendMessageView.as_view(), name='coach_send_message'),
    path('logs/', views.InteractionLogListView.as_view(), name='interaction_logs'),
    path('unread/', views.UnreadMessagesCountView.as_view(), name='unread_messages'),
]
