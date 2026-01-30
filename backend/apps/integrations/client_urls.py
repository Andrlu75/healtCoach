from django.urls import path
from . import views

# URLs для miniapp клиентов (требуют авторизации)
urlpatterns = [
    path('google-fit/auth-url/', views.GoogleFitAuthURLView.as_view(), name='google_fit_auth_url'),
    path('google-fit/status/', views.GoogleFitStatusView.as_view(), name='google_fit_status'),
    path('google-fit/disconnect/', views.GoogleFitDisconnectView.as_view(), name='google_fit_disconnect'),
    path('google-fit/sync/', views.GoogleFitManualSyncView.as_view(), name='google_fit_sync'),
]
