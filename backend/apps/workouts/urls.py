from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WorkoutTemplateViewSet,
    WorkoutTemplateBlockViewSet,
    ClientWorkoutViewSet,
    WorkoutBlockViewSet,
    WorkoutExerciseViewSet,
    TrainingScheduleViewSet,
    TrainingProgramViewSet,
    WorkoutSessionViewSet,
)
from .views.fitdb import (
    FitDBWorkoutViewSet, FitDBWorkoutExerciseViewSet,
    FitDBAssignmentViewSet, FitDBSessionViewSet, FitDBExerciseLogViewSet,
    FitDBActivityLogViewSet
)

router = DefaultRouter()
# Шаблоны
router.register('templates', WorkoutTemplateViewSet, basename='workout-template')
router.register('template-blocks', WorkoutTemplateBlockViewSet, basename='template-block')
# Тренировки клиента
router.register('client-workouts', ClientWorkoutViewSet, basename='client-workout')
router.register('blocks', WorkoutBlockViewSet, basename='workout-block')
router.register('exercises', WorkoutExerciseViewSet, basename='workout-exercise')
# Расписание
router.register('schedules', TrainingScheduleViewSet, basename='training-schedule')
router.register('programs', TrainingProgramViewSet, basename='training-program')
# Прогресс
router.register('sessions', WorkoutSessionViewSet, basename='workout-session')

# FitDB public router
fitdb_router = DefaultRouter()
fitdb_router.register('workouts', FitDBWorkoutViewSet, basename='fitdb-workout')
fitdb_router.register('workout-exercises', FitDBWorkoutExerciseViewSet, basename='fitdb-workout-exercise')

# FitDB assignments, sessions, logs (outside fitdb/ prefix for backwards compatibility)
assignments_router = DefaultRouter()
assignments_router.register('assignments', FitDBAssignmentViewSet, basename='fitdb-assignment')
assignments_router.register('sessions', FitDBSessionViewSet, basename='fitdb-session')
assignments_router.register('exercise-logs', FitDBExerciseLogViewSet, basename='fitdb-exercise-log')
assignments_router.register('activity-logs', FitDBActivityLogViewSet, basename='fitdb-activity-log')

urlpatterns = [
    path('fitdb/', include(fitdb_router.urls)),
    path('', include(assignments_router.urls)),
    path('', include(router.urls)),
]
