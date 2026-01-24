from django.urls import path

from . import views

urlpatterns = [
    path('', views.HealthMetricListView.as_view(), name='metric_list'),
]
