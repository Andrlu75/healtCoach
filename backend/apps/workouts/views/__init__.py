from .templates import WorkoutTemplateViewSet, WorkoutTemplateBlockViewSet
from .workouts import ClientWorkoutViewSet, WorkoutBlockViewSet, WorkoutExerciseViewSet, TodayWorkoutsDashboardView
from .scheduling import TrainingScheduleViewSet, TrainingProgramViewSet
from .progress import WorkoutSessionViewSet

__all__ = [
    'WorkoutTemplateViewSet',
    'WorkoutTemplateBlockViewSet',
    'ClientWorkoutViewSet',
    'WorkoutBlockViewSet',
    'WorkoutExerciseViewSet',
    'TrainingScheduleViewSet',
    'TrainingProgramViewSet',
    'WorkoutSessionViewSet',
    'TodayWorkoutsDashboardView',
]
