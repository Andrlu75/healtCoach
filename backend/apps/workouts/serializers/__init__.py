from .templates import (
    WorkoutTemplateListSerializer,
    WorkoutTemplateDetailSerializer,
    WorkoutTemplateCreateSerializer,
    WorkoutTemplateBlockSerializer,
    WorkoutTemplateExerciseSerializer,
)
from .workouts import (
    ClientWorkoutListSerializer,
    ClientWorkoutDetailSerializer,
    ClientWorkoutCreateSerializer,
    WorkoutBlockSerializer,
    WorkoutExerciseSerializer,
    WorkoutSupersetSerializer,
)
from .scheduling import (
    TrainingScheduleSerializer,
    TrainingProgramListSerializer,
    TrainingProgramDetailSerializer,
    ProgramWorkoutSerializer,
)
from .progress import (
    WorkoutSessionSerializer,
    WorkoutSessionDetailSerializer,
    ExerciseLogSerializer,
    StartSessionSerializer,
    LogSetSerializer,
)

__all__ = [
    # Шаблоны
    'WorkoutTemplateListSerializer',
    'WorkoutTemplateDetailSerializer',
    'WorkoutTemplateCreateSerializer',
    'WorkoutTemplateBlockSerializer',
    'WorkoutTemplateExerciseSerializer',
    # Тренировки
    'ClientWorkoutListSerializer',
    'ClientWorkoutDetailSerializer',
    'ClientWorkoutCreateSerializer',
    'WorkoutBlockSerializer',
    'WorkoutExerciseSerializer',
    'WorkoutSupersetSerializer',
    # Расписание
    'TrainingScheduleSerializer',
    'TrainingProgramListSerializer',
    'TrainingProgramDetailSerializer',
    'ProgramWorkoutSerializer',
    # Прогресс
    'WorkoutSessionSerializer',
    'WorkoutSessionDetailSerializer',
    'ExerciseLogSerializer',
    'StartSessionSerializer',
    'LogSetSerializer',
]
