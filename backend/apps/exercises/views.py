from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import ExerciseCategory, ExerciseType, Exercise
from .serializers import (
    ExerciseCategorySerializer,
    ExerciseTypeSerializer,
    ExerciseListSerializer,
    ExerciseDetailSerializer,
    ExerciseCreateUpdateSerializer,
)


# FitDB serializer - maps Django Exercise to FitDB format
class FitDBExerciseSerializer(serializers.ModelSerializer):
    muscleGroup = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    imageUrl = serializers.SerializerMethodField()
    equipment = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = ['id', 'name', 'description', 'muscleGroup', 'category', 'difficulty', 'equipment', 'imageUrl']

    def get_muscleGroup(self, obj):
        # Map Django muscle_groups list to single FitDB muscleGroup
        if obj.muscle_groups:
            # Map Russian to English (check all muscle groups for best match)
            mapping = {
                'грудь': 'chest', 'грудные': 'chest', 'грудные мышцы': 'chest', 'большая грудная': 'chest',
                'спина': 'back', 'широчайшие': 'back', 'трапеции': 'back', 'ромбовидные': 'back',
                'плечи': 'shoulders', 'дельты': 'shoulders', 'дельтовидные': 'shoulders', 'ротаторы плеча': 'shoulders',
                'бицепс': 'biceps', 'бицепсы': 'biceps',
                'трицепс': 'triceps', 'трицепсы': 'triceps',
                'ноги': 'legs', 'квадрицепс': 'legs', 'квадрицепсы': 'legs', 'бицепс бедра': 'legs',
                'икры': 'legs', 'икроножные': 'legs', 'приводящие': 'legs', 'приводящие мышцы': 'legs',
                'ягодицы': 'glutes', 'ягодичные': 'glutes',
                'пресс': 'abs', 'кор': 'abs', 'косые': 'abs', 'косые мышцы': 'abs',
                'кардио': 'cardio', 'сердечно-сосудистая система': 'cardio', 'всё тело': 'cardio',
            }

            # Try each muscle group in the list
            for mg in obj.muscle_groups if isinstance(obj.muscle_groups, list) else [obj.muscle_groups]:
                mg_lower = mg.lower()
                if mg_lower in mapping:
                    return mapping[mg_lower]
                # Partial match
                for key, value in mapping.items():
                    if key in mg_lower or mg_lower in key:
                        return value

        return 'chest'

    def get_category(self, obj):
        # Return strength for most, cardio for cardio exercises
        if obj.muscle_groups and any('кардио' in str(mg).lower() for mg in obj.muscle_groups):
            return 'cardio'
        return 'strength'

    def get_imageUrl(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_equipment(self, obj):
        if obj.equipment:
            return ', '.join(obj.equipment) if isinstance(obj.equipment, list) else str(obj.equipment)
        return None


class FitDBExerciseViewSet(viewsets.ModelViewSet):
    """Public FitDB API for exercises"""
    permission_classes = [AllowAny]
    serializer_class = FitDBExerciseSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'difficulty']
    ordering = ['-created_at']

    def get_queryset(self):
        return Exercise.objects.filter(is_active=True)

    def create(self, request, *args, **kwargs):
        # Map FitDB format to Django format
        data = request.data.copy()
        muscle_group = data.pop('muscleGroup', 'chest')
        category = data.pop('category', 'strength')
        image_url = data.pop('imageUrl', None)
        equipment = data.pop('equipment', None)

        # Map to Django fields
        data['muscle_groups'] = [muscle_group]
        if equipment:
            data['equipment'] = [equipment] if isinstance(equipment, str) else equipment

        # Get first coach for now
        from apps.accounts.models import Coach
        coach = Coach.objects.first()
        if not coach:
            return Response({'error': 'No coach found'}, status=400)

        exercise = Exercise.objects.create(
            coach=coach,
            name=data.get('name', ''),
            description=data.get('description', ''),
            muscle_groups=data.get('muscle_groups', []),
            equipment=data.get('equipment', []),
            difficulty=data.get('difficulty', 'intermediate'),
        )
        serializer = self.get_serializer(exercise)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data.copy()

        muscle_group = data.pop('muscleGroup', None)
        category = data.pop('category', None)
        equipment = data.pop('equipment', None)

        if muscle_group:
            instance.muscle_groups = [muscle_group]
        if equipment:
            instance.equipment = [equipment] if isinstance(equipment, str) else equipment
        if 'name' in data:
            instance.name = data['name']
        if 'description' in data:
            instance.description = data['description']
        if 'difficulty' in data:
            instance.difficulty = data['difficulty']

        instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ExerciseCategoryViewSet(viewsets.ModelViewSet):
    """CRUD для категорий упражнений"""
    serializer_class = ExerciseCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ExerciseCategory.objects.filter(
            coach=self.request.user.coach_profile
        )

    def perform_create(self, serializer):
        serializer.save(coach=self.request.user.coach_profile)

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Изменение порядка категорий"""
        order_data = request.data.get('order', [])
        for item in order_data:
            ExerciseCategory.objects.filter(
                id=item['id'],
                coach=request.user.coach_profile
            ).update(order=item['order'])
        return Response({'status': 'ok'})


class ExerciseTypeViewSet(viewsets.ModelViewSet):
    """CRUD для типов упражнений"""
    serializer_class = ExerciseTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ExerciseType.objects.filter(
            coach=self.request.user.coach_profile
        )

    def perform_create(self, serializer):
        serializer.save(coach=self.request.user.coach_profile)

    @action(detail=False, methods=['get'])
    def parameter_options(self, request):
        """Список доступных параметров для типов упражнений"""
        return Response([
            {'key': key, 'label': label}
            for key, label in ExerciseType.PARAMETER_TYPES
        ])


class ExerciseViewSet(viewsets.ModelViewSet):
    """CRUD для упражнений"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'exercise_type', 'difficulty', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'difficulty']
    ordering = ['name']

    def get_queryset(self):
        return Exercise.objects.filter(
            coach=self.request.user.coach_profile
        ).select_related('category', 'exercise_type')

    def get_serializer_class(self):
        if self.action == 'list':
            return ExerciseListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ExerciseCreateUpdateSerializer
        return ExerciseDetailSerializer

    def perform_create(self, serializer):
        serializer.save(coach=self.request.user.coach_profile)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Дублирование упражнения"""
        exercise = self.get_object()
        new_exercise = Exercise.objects.create(
            coach=exercise.coach,
            category=exercise.category,
            exercise_type=exercise.exercise_type,
            name=f"{exercise.name} (копия)",
            description=exercise.description,
            instructions=exercise.instructions,
            video_url=exercise.video_url,
            media_type=exercise.media_type,
            default_parameters=exercise.default_parameters,
            muscle_groups=exercise.muscle_groups,
            equipment=exercise.equipment,
            difficulty=exercise.difficulty,
        )
        # Копируем изображение, если есть
        if exercise.image:
            new_exercise.image = exercise.image
            new_exercise.save()

        serializer = ExerciseDetailSerializer(new_exercise)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Упражнения сгруппированные по категориям"""
        categories = ExerciseCategory.objects.filter(
            coach=request.user.coach_profile,
            is_active=True
        ).prefetch_related('exercises')

        result = []
        for category in categories:
            exercises = category.exercises.filter(is_active=True)
            result.append({
                'category': ExerciseCategorySerializer(category).data,
                'exercises': ExerciseListSerializer(exercises, many=True).data
            })

        # Упражнения без категории
        uncategorized = Exercise.objects.filter(
            coach=request.user.coach_profile,
            category__isnull=True,
            is_active=True
        )
        if uncategorized.exists():
            result.append({
                'category': {'id': None, 'name': 'Без категории'},
                'exercises': ExerciseListSerializer(uncategorized, many=True).data
            })

        return Response(result)
