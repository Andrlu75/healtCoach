from django.urls import path
from . import views
from . import huawei_views

# URLs для miniapp клиентов (требуют авторизации)
urlpatterns = [
    # Google Fit
    path('google-fit/auth-url/', views.GoogleFitAuthURLView.as_view(), name='google_fit_auth_url'),
    path('google-fit/status/', views.GoogleFitStatusView.as_view(), name='google_fit_status'),
    path('google-fit/disconnect/', views.GoogleFitDisconnectView.as_view(), name='google_fit_disconnect'),
    path('google-fit/sync/', views.GoogleFitManualSyncView.as_view(), name='google_fit_sync'),

    # Huawei Health
    path('huawei-health/auth-url/', huawei_views.HuaweiHealthAuthURLView.as_view(), name='huawei_health_auth_url'),
    path('huawei-health/status/', huawei_views.HuaweiHealthStatusView.as_view(), name='huawei_health_status'),
    path('huawei-health/disconnect/', huawei_views.HuaweiHealthDisconnectView.as_view(), name='huawei_health_disconnect'),
    path('huawei-health/sync/', huawei_views.HuaweiHealthManualSyncView.as_view(), name='huawei_health_sync'),
]
