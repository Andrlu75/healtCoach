from django.urls import path
from . import views
from . import huawei_views

urlpatterns = [
    # OAuth callbacks (публичные, вызываются провайдерами)
    path('google-fit/callback/', views.GoogleFitCallbackView.as_view(), name='google_fit_callback'),
    path('huawei-health/callback/', huawei_views.HuaweiHealthCallbackView.as_view(), name='huawei_health_callback'),
]
