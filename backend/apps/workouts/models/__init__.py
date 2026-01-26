from .templates import WorkoutTemplate, WorkoutTemplateBlock, WorkoutTemplateExercise
from .workouts import ClientWorkout, WorkoutBlock, WorkoutExercise, WorkoutSuperset
from .scheduling import TrainingSchedule, TrainingProgram, ProgramWorkout
from .progress import WorkoutSession, ExerciseLog

__all__ = [
    # Шаблоны
    'WorkoutTemplate',
    'WorkoutTemplateBlock',
    'WorkoutTemplateExercise',
    # Тренировки клиента
    'ClientWorkout',
    'WorkoutBlock',
    'WorkoutExercise',
    'WorkoutSuperset',
    # Расписание
    'TrainingSchedule',
    'TrainingProgram',
    'ProgramWorkout',
    # Прогресс
    'WorkoutSession',
    'ExerciseLog',
]
