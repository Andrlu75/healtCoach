from rest_framework import serializers
from apps.workouts.models import ClientWorkout, WorkoutBlock, WorkoutExercise, WorkoutSuperset
from apps.exercises.serializers import ExerciseListSerializer


class WorkoutExerciseSerializer(serializers.ModelSerializer):
    exercise_detail = ExerciseListSerializer(source='exercise', read_only=True)

    class Meta:
        model = WorkoutExercise
        fields = [
            'id', 'exercise', 'exercise_detail', 'superset',
            'order', 'parameters', 'rest_after', 'notes'
        ]


class WorkoutSupersetSerializer(serializers.ModelSerializer):
    exercises = WorkoutExerciseSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutSuperset
        fields = [
            'id', 'name', 'order', 'rounds', 'rest_after', 'exercises'
        ]


class WorkoutBlockSerializer(serializers.ModelSerializer):
    exercises = WorkoutExerciseSerializer(many=True, read_only=True)
    supersets = WorkoutSupersetSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutBlock
        fields = [
            'id', 'name', 'block_type', 'order',
            'rounds', 'rest_between_rounds', 'exercises', 'supersets'
        ]


class ClientWorkoutListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.__str__', read_only=True)
    blocks_count = serializers.SerializerMethodField()
    exercises_count = serializers.SerializerMethodField()
    last_session = serializers.SerializerMethodField()

    class Meta:
        model = ClientWorkout
        fields = [
            'id', 'client', 'client_name', 'name', 'description',
            'scheduled_date', 'scheduled_time', 'status',
            'estimated_duration', 'difficulty',
            'blocks_count', 'exercises_count', 'last_session',
            'created_at'
        ]

    def get_blocks_count(self, obj):
        return obj.blocks.count()

    def get_exercises_count(self, obj):
        return WorkoutExercise.objects.filter(block__workout=obj).count()

    def get_last_session(self, obj):
        session = obj.sessions.first()
        if session:
            return {
                'id': session.id,
                'status': session.status,
                'started_at': session.started_at,
                'completion_percentage': session.completion_percentage
            }
        return None


class ClientWorkoutDetailSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.__str__', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True)
    blocks = WorkoutBlockSerializer(many=True, read_only=True)

    class Meta:
        model = ClientWorkout
        fields = [
            'id', 'client', 'client_name', 'template', 'template_name',
            'name', 'description', 'scheduled_date', 'scheduled_time',
            'status', 'estimated_duration', 'difficulty', 'notes',
            'reminder_enabled', 'reminder_minutes_before',
            'blocks', 'created_at', 'updated_at'
        ]


class ClientWorkoutCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientWorkout
        fields = [
            'client', 'template', 'name', 'description',
            'scheduled_date', 'scheduled_time', 'status',
            'estimated_duration', 'difficulty', 'notes',
            'reminder_enabled', 'reminder_minutes_before'
        ]

    def validate_client(self, value):
        """Проверяем, что клиент принадлежит коучу"""
        if value.coach != self.context['request'].user.coach_profile:
            raise serializers.ValidationError("Клиент не найден")
        return value

    def validate_template(self, value):
        """Проверяем, что шаблон принадлежит коучу"""
        if value and value.coach != self.context['request'].user.coach_profile:
            raise serializers.ValidationError("Шаблон не найден")
        return value
