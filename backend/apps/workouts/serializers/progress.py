from rest_framework import serializers
from apps.workouts.models import WorkoutSession, ExerciseLog


class ExerciseLogSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(
        source='workout_exercise.exercise.name',
        read_only=True
    )

    class Meta:
        model = ExerciseLog
        fields = [
            'id', 'workout_exercise', 'exercise_name', 'set_number',
            'actual_parameters', 'planned_parameters',
            'is_completed', 'started_at', 'finished_at',
            'notes', 'is_improved'
        ]
        read_only_fields = ['is_improved']


class WorkoutSessionSerializer(serializers.ModelSerializer):
    workout_name = serializers.CharField(source='workout.name', read_only=True)

    class Meta:
        model = WorkoutSession
        fields = [
            'id', 'workout', 'workout_name', 'started_at', 'finished_at',
            'status', 'duration_seconds',
            'total_exercises', 'completed_exercises',
            'total_sets', 'completed_sets',
            'completion_percentage', 'calories_burned',
            'client_notes', 'client_rating', 'fatigue_level'
        ]
        read_only_fields = ['completion_percentage']


class WorkoutSessionDetailSerializer(serializers.ModelSerializer):
    workout_name = serializers.CharField(source='workout.name', read_only=True)
    exercise_logs = ExerciseLogSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutSession
        fields = [
            'id', 'workout', 'workout_name', 'started_at', 'finished_at',
            'status', 'duration_seconds',
            'total_exercises', 'completed_exercises',
            'total_sets', 'completed_sets',
            'completion_percentage', 'calories_burned',
            'client_notes', 'client_rating', 'fatigue_level',
            'exercise_logs'
        ]


class StartSessionSerializer(serializers.Serializer):
    """Сериализатор для начала сессии тренировки"""
    workout_id = serializers.IntegerField()

    def validate_workout_id(self, value):
        from apps.workouts.models import ClientWorkout
        try:
            workout = ClientWorkout.objects.get(id=value)
            # Проверяем, что нет активной сессии
            if workout.sessions.filter(status='in_progress').exists():
                raise serializers.ValidationError(
                    "У этой тренировки уже есть активная сессия"
                )
            self.workout = workout
            return value
        except ClientWorkout.DoesNotExist:
            raise serializers.ValidationError("Тренировка не найдена")


class LogSetSerializer(serializers.Serializer):
    """Сериализатор для логирования подхода"""
    workout_exercise_id = serializers.IntegerField()
    set_number = serializers.IntegerField(min_value=1)
    actual_parameters = serializers.JSONField()
    is_completed = serializers.BooleanField(default=True)
    notes = serializers.CharField(required=False, allow_blank=True)
