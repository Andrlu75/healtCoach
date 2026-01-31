from django.urls import path
from . import views
from . import huawei_views
from . import coach_views

urlpatterns = [
    # OAuth callbacks (публичные, вызываются провайдерами)
    path('google-fit/callback/', views.GoogleFitCallbackView.as_view(), name='google_fit_callback'),
    path('huawei-health/callback/', huawei_views.HuaweiHealthCallbackView.as_view(), name='huawei_health_callback'),

    # Coach API
    path('overview/', coach_views.IntegrationsOverviewView.as_view(), name='integrations_overview'),
    path('sync/', coach_views.TriggerSyncView.as_view(), name='trigger_sync'),
    path('disconnect/', coach_views.DisconnectIntegrationView.as_view(), name='disconnect_integration'),
    path('logs/', coach_views.SyncLogsView.as_view(), name='sync_logs'),
]
