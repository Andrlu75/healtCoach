from rest_framework import serializers
from apps.workouts.models import WorkoutTemplate, WorkoutTemplateBlock, WorkoutTemplateExercise
from apps.exercises.serializers import ExerciseListSerializer


class WorkoutTemplateExerciseSerializer(serializers.ModelSerializer):
    exercise_detail = ExerciseListSerializer(source='exercise', read_only=True)

    class Meta:
        model = WorkoutTemplateExercise
        fields = [
            'id', 'exercise', 'exercise_detail', 'order',
            'parameters', 'rest_after', 'superset_group', 'notes'
        ]


class WorkoutTemplateBlockSerializer(serializers.ModelSerializer):
    exercises = WorkoutTemplateExerciseSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutTemplateBlock
        fields = [
            'id', 'name', 'block_type', 'order',
            'rounds', 'rest_between_rounds', 'exercises'
        ]


class WorkoutTemplateListSerializer(serializers.ModelSerializer):
    blocks_count = serializers.SerializerMethodField()
    exercises_count = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutTemplate
        fields = [
            'id', 'name', 'description', 'estimated_duration',
            'difficulty', 'tags', 'is_active',
            'blocks_count', 'exercises_count', 'created_at'
        ]

    def get_blocks_count(self, obj):
        return obj.blocks.count()

    def get_exercises_count(self, obj):
        return WorkoutTemplateExercise.objects.filter(block__template=obj).count()


class WorkoutTemplateDetailSerializer(serializers.ModelSerializer):
    blocks = WorkoutTemplateBlockSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutTemplate
        fields = [
            'id', 'name', 'description', 'estimated_duration',
            'difficulty', 'tags', 'is_active', 'blocks',
            'created_at', 'updated_at'
        ]


class WorkoutTemplateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutTemplate
        fields = [
            'name', 'description', 'estimated_duration',
            'difficulty', 'tags', 'is_active'
        ]
