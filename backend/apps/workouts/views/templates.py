from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.workouts.models import WorkoutTemplate, WorkoutTemplateBlock, WorkoutTemplateExercise
from apps.workouts.serializers import (
    WorkoutTemplateListSerializer,
    WorkoutTemplateDetailSerializer,
    WorkoutTemplateCreateSerializer,
    WorkoutTemplateBlockSerializer,
    WorkoutTemplateExerciseSerializer,
)


class WorkoutTemplateViewSet(viewsets.ModelViewSet):
    """CRUD для шаблонов тренировок"""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WorkoutTemplate.objects.filter(
            coach=self.request.user.coach_profile
        ).prefetch_related('blocks__exercises')

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkoutTemplateListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return WorkoutTemplateCreateSerializer
        return WorkoutTemplateDetailSerializer

    def perform_create(self, serializer):
        serializer.save(coach=self.request.user.coach_profile)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Дублирование шаблона"""
        template = self.get_object()
        new_template = WorkoutTemplate.objects.create(
            coach=template.coach,
            name=f"{template.name} (копия)",
            description=template.description,
            estimated_duration=template.estimated_duration,
            difficulty=template.difficulty,
            tags=template.tags,
        )
        # Копируем блоки и упражнения
        for block in template.blocks.all():
            new_block = WorkoutTemplateBlock.objects.create(
                template=new_template,
                name=block.name,
                block_type=block.block_type,
                order=block.order,
                rounds=block.rounds,
                rest_between_rounds=block.rest_between_rounds,
            )
            for exercise in block.exercises.all():
                WorkoutTemplateExercise.objects.create(
                    block=new_block,
                    exercise=exercise.exercise,
                    order=exercise.order,
                    parameters=exercise.parameters,
                    rest_after=exercise.rest_after,
                    superset_group=exercise.superset_group,
                    notes=exercise.notes,
                )

        serializer = WorkoutTemplateDetailSerializer(new_template)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def add_block(self, request, pk=None):
        """Добавление блока в шаблон"""
        template = self.get_object()
        serializer = WorkoutTemplateBlockSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(template=template)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkoutTemplateBlockViewSet(viewsets.ModelViewSet):
    """CRUD для блоков шаблона"""
    serializer_class = WorkoutTemplateBlockSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WorkoutTemplateBlock.objects.filter(
            template__coach=self.request.user.coach_profile
        )

    @action(detail=True, methods=['post'])
    def add_exercise(self, request, pk=None):
        """Добавление упражнения в блок"""
        block = self.get_object()
        serializer = WorkoutTemplateExerciseSerializer(data=request.data)
        if serializer.is_valid():
            # Проверяем, что упражнение принадлежит коучу
            exercise = serializer.validated_data['exercise']
            if exercise.coach != self.request.user.coach_profile:
                return Response(
                    {'error': 'Упражнение не найдено'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            serializer.save(block=block)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reorder_exercises(self, request, pk=None):
        """Изменение порядка упражнений"""
        block = self.get_object()
        order_data = request.data.get('order', [])
        for item in order_data:
            WorkoutTemplateExercise.objects.filter(
                id=item['id'],
                block=block
            ).update(order=item['order'])
        return Response({'status': 'ok'})
