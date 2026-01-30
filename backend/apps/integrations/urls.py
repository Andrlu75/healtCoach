from django.urls import path
from . import views

urlpatterns = [
    # OAuth callback (публичный, вызывается Google)
    path('google-fit/callback/', views.GoogleFitCallbackView.as_view(), name='google_fit_callback'),
]
