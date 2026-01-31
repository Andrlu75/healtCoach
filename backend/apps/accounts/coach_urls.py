from django.urls import path
from .views import CoachProfileView, ChangePasswordView

coach_profile = CoachProfileView.as_view({
    'get': 'list',
    'patch': 'partial_update',
})

urlpatterns = [
    path('profile/', coach_profile, name='coach_profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
]
