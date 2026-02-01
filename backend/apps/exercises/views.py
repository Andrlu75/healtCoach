from django.db.models import Prefetch, Q
from rest_framework import viewsets, status, serializers, pagination
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


# FitDB serializer - optimized with single to_representation instead of multiple SerializerMethodField
class FitDBExerciseSerializer(serializers.Serializer):
    """Optimized serializer - avoids multiple method calls per object"""

    # Static mapping for muscle groups
    MUSCLE_GROUP_MAP = {
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
        'chest': 'chest', 'back': 'back', 'shoulders': 'shoulders', 'biceps': 'biceps',
        'triceps': 'triceps', 'legs': 'legs', 'glutes': 'glutes', 'abs': 'abs', 'cardio': 'cardio',
    }

    def to_representation(self, obj):
        # Map muscle groups
        muscle_groups = ['chest']
        is_cardio = False
        if obj.muscle_groups:
            muscle_list = obj.muscle_groups if isinstance(obj.muscle_groups, list) else [obj.muscle_groups]
            result = []
            for mg in muscle_list:
                mg_lower = mg.lower() if isinstance(mg, str) else mg
                if 'кардио' in str(mg_lower):
                    is_cardio = True
                mapped = self.MUSCLE_GROUP_MAP.get(mg_lower)
                if mapped and mapped not in result:
                    result.append(mapped)
            if result:
                muscle_groups = result

        # Build image URL
        image_url = None
        if obj.image:
            request = self.context.get('request')
            if request:
                image_url = request.build_absolute_uri(obj.image.url)
            else:
                image_url = obj.image.url

        # Equipment
        equipment = None
        if obj.equipment:
            equipment = ', '.join(obj.equipment) if isinstance(obj.equipment, list) else str(obj.equipment)

        return {
            'id': obj.id,
            'name': obj.name,
            'description': obj.description or '',
            'muscleGroups': muscle_groups,
            'category': 'cardio' if is_cardio else 'strength',
            'difficulty': obj.difficulty,
            'equipment': equipment,
            'imageUrl': image_url,
        }


class FitDBExercisePagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class FitDBExerciseViewSet(viewsets.ModelViewSet):
    """FitDB API for exercises - requires authentication"""
    permission_classes = [IsAuthenticated]
    serializer_class = FitDBExerciseSerializer
    pagination_class = FitDBExercisePagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'difficulty']
    ordering = ['-created_at']

    def get_queryset(self):
        coach = self.request.user.coach_profile

        # Упражнения текущего коуча + общая база активных упражнений
        queryset = Exercise.objects.filter(
            Q(coach=coach) | Q(is_active=True)
        ).distinct().only(
            'id', 'name', 'description', 'muscle_groups', 'difficulty', 'equipment', 'image'
        )

        # Filter by muscle group (supports both English and Russian)
        muscle_group = self.request.query_params.get('muscle_group')
        if muscle_group:
            # Build list of matching Russian muscle groups
            matching_groups = [
                ru_name for ru_name, en_name in self.serializer_class.MUSCLE_GROUP_MAP.items()
                if en_name == muscle_group
            ]
            if matching_groups:
                q = Q()
                for mg in matching_groups:
                    q |= Q(muscle_groups__icontains=mg)
                queryset = queryset.filter(q)

        return queryset

    def create(self, request, *args, **kwargs):
        # Map FitDB format to Django format
        data = request.data.copy()
        muscle_groups = data.pop('muscleGroups', ['chest'])
        category = data.pop('category', 'strength')
        image_url = data.pop('imageUrl', None)
        equipment = data.pop('equipment', None)

        # Ensure muscle_groups is a list
        if isinstance(muscle_groups, str):
            muscle_groups = [muscle_groups]

        # Map to Django fields
        data['muscle_groups'] = muscle_groups
        if equipment:
            data['equipment'] = [equipment] if isinstance(equipment, str) else equipment

        # Используем коуча из текущей сессии
        coach = request.user.coach_profile

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

        muscle_groups = data.pop('muscleGroups', None)
        category = data.pop('category', None)
        equipment = data.pop('equipment', None)

        if muscle_groups:
            if isinstance(muscle_groups, str):
                muscle_groups = [muscle_groups]
            instance.muscle_groups = muscle_groups
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
        # Используем Prefetch с фильтрацией для избежания N+1
        active_exercises = Prefetch(
            'exercises',
            queryset=Exercise.objects.filter(is_active=True),
            to_attr='active_exercises'
        )
        categories = ExerciseCategory.objects.filter(
            coach=request.user.coach_profile,
            is_active=True
        ).prefetch_related(active_exercises)

        result = []
        for category in categories:
            # Используем уже загруженные active_exercises вместо нового запроса
            result.append({
                'category': ExerciseCategorySerializer(category).data,
                'exercises': ExerciseListSerializer(category.active_exercises, many=True).data
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
