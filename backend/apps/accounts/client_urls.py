from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, FitDBClientViewSet

router = DefaultRouter()
router.register('', ClientViewSet, basename='client')

# FitDB public router
fitdb_router = DefaultRouter()
fitdb_router.register('', FitDBClientViewSet, basename='fitdb-client')

urlpatterns = [
    path('fitdb/', include(fitdb_router.urls)),
    path('', include(router.urls)),
]
