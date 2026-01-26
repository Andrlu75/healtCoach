from rest_framework import serializers
from .models import ExerciseCategory, ExerciseType, Exercise


class ExerciseCategorySerializer(serializers.ModelSerializer):
    exercises_count = serializers.SerializerMethodField()

    class Meta:
        model = ExerciseCategory
        fields = [
            'id', 'name', 'description', 'color', 'icon',
            'order', 'is_active', 'exercises_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'exercises_count']

    def get_exercises_count(self, obj):
        return obj.exercises.filter(is_active=True).count()


class ExerciseTypeSerializer(serializers.ModelSerializer):
    parameters_display = serializers.SerializerMethodField()

    class Meta:
        model = ExerciseType
        fields = [
            'id', 'name', 'description', 'parameters',
            'parameters_display', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'parameters_display']

    def get_parameters_display(self, obj):
        """Возвращает читаемые названия параметров"""
        param_names = dict(ExerciseType.PARAMETER_TYPES)
        return [
            {'key': p, 'label': param_names.get(p, p)}
            for p in obj.parameters
        ]


class ExerciseListSerializer(serializers.ModelSerializer):
    """Сериализатор для списка упражнений (краткий)"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    type_name = serializers.CharField(source='exercise_type.name', read_only=True)

    class Meta:
        model = Exercise
        fields = [
            'id', 'name', 'category', 'category_name',
            'exercise_type', 'type_name', 'difficulty',
            'image', 'video_url', 'media_type', 'is_active'
        ]


class ExerciseDetailSerializer(serializers.ModelSerializer):
    """Сериализатор для детального просмотра/редактирования упражнения"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    type_name = serializers.CharField(source='exercise_type.name', read_only=True)
    type_parameters = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = [
            'id', 'name', 'description', 'instructions',
            'category', 'category_name',
            'exercise_type', 'type_name', 'type_parameters',
            'image', 'video_url', 'media_type',
            'default_parameters', 'muscle_groups', 'equipment',
            'difficulty', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'category_name', 'type_name', 'type_parameters']

    def get_type_parameters(self, obj):
        """Возвращает параметры типа упражнения"""
        if obj.exercise_type:
            param_names = dict(ExerciseType.PARAMETER_TYPES)
            return [
                {'key': p, 'label': param_names.get(p, p)}
                for p in obj.exercise_type.parameters
            ]
        return []


class ExerciseCreateUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания/обновления упражнения"""

    class Meta:
        model = Exercise
        fields = [
            'name', 'description', 'instructions',
            'category', 'exercise_type',
            'image', 'video_url', 'media_type',
            'default_parameters', 'muscle_groups', 'equipment',
            'difficulty', 'is_active'
        ]

    def validate_category(self, value):
        """Проверяем, что категория принадлежит коучу"""
        if value and value.coach != self.context['request'].user.coach_profile:
            raise serializers.ValidationError("Категория не найдена")
        return value

    def validate_exercise_type(self, value):
        """Проверяем, что тип принадлежит коучу"""
        if value and value.coach != self.context['request'].user.coach_profile:
            raise serializers.ValidationError("Тип упражнения не найден")
        return value
