from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExerciseCategoryViewSet, ExerciseTypeViewSet, ExerciseViewSet, FitDBExerciseViewSet

router = DefaultRouter()
router.register('categories', ExerciseCategoryViewSet, basename='exercise-category')
router.register('types', ExerciseTypeViewSet, basename='exercise-type')
router.register('exercises', ExerciseViewSet, basename='exercise')

# FitDB router - public API
fitdb_router = DefaultRouter()
fitdb_router.register('exercises', FitDBExerciseViewSet, basename='fitdb-exercise')

urlpatterns = [
    path('', include(router.urls)),
    path('fitdb/', include(fitdb_router.urls)),
]
