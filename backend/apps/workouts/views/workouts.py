from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.workouts.models import (
    ClientWorkout, WorkoutBlock, WorkoutExercise, WorkoutSuperset,
    WorkoutTemplate, WorkoutTemplateBlock, WorkoutTemplateExercise,
)
from apps.workouts.serializers import (
    ClientWorkoutListSerializer,
    ClientWorkoutDetailSerializer,
    ClientWorkoutCreateSerializer,
    WorkoutBlockSerializer,
    WorkoutExerciseSerializer,
    WorkoutSupersetSerializer,
)


class ClientWorkoutViewSet(viewsets.ModelViewSet):
    """CRUD для тренировок клиента"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['client', 'status', 'scheduled_date']
    search_fields = ['name', 'description']
    ordering_fields = ['scheduled_date', 'created_at', 'name']
    ordering = ['-scheduled_date']

    def get_queryset(self):
        return ClientWorkout.objects.filter(
            client__coach=self.request.user.coach_profile
        ).select_related('client', 'template').prefetch_related(
            'blocks__exercises__exercise',
            'blocks__supersets__exercises'
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientWorkoutListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ClientWorkoutCreateSerializer
        return ClientWorkoutDetailSerializer

    @action(detail=False, methods=['post'])
    def create_from_template(self, request):
        """Создание тренировки из шаблона"""
        template_id = request.data.get('template_id')
        client_id = request.data.get('client_id')
        scheduled_date = request.data.get('scheduled_date')
        scheduled_time = request.data.get('scheduled_time')

        try:
            template = WorkoutTemplate.objects.get(
                id=template_id,
                coach=request.user.coach_profile
            )
        except WorkoutTemplate.DoesNotExist:
            return Response(
                {'error': 'Шаблон не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

        from apps.accounts.models import Client
        try:
            client = Client.objects.get(
                id=client_id,
                coach=request.user.coach_profile
            )
        except Client.DoesNotExist:
            return Response(
                {'error': 'Клиент не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Создаём тренировку
        workout = ClientWorkout.objects.create(
            client=client,
            template=template,
            name=template.name,
            description=template.description,
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time,
            estimated_duration=template.estimated_duration,
            difficulty=template.difficulty,
            status='scheduled' if scheduled_date else 'draft',
        )

        # Копируем блоки и упражнения
        for tmpl_block in template.blocks.all():
            block = WorkoutBlock.objects.create(
                workout=workout,
                name=tmpl_block.name,
                block_type=tmpl_block.block_type,
                order=tmpl_block.order,
                rounds=tmpl_block.rounds,
                rest_between_rounds=tmpl_block.rest_between_rounds,
            )
            # Группируем упражнения по суперсетам
            superset_map = {}
            for tmpl_ex in tmpl_block.exercises.all():
                superset = None
                if tmpl_ex.superset_group is not None:
                    if tmpl_ex.superset_group not in superset_map:
                        superset_map[tmpl_ex.superset_group] = WorkoutSuperset.objects.create(
                            block=block,
                            order=tmpl_ex.superset_group,
                        )
                    superset = superset_map[tmpl_ex.superset_group]

                WorkoutExercise.objects.create(
                    block=block,
                    exercise=tmpl_ex.exercise,
                    superset=superset,
                    order=tmpl_ex.order,
                    parameters=tmpl_ex.parameters,
                    rest_after=tmpl_ex.rest_after,
                    notes=tmpl_ex.notes,
                )

        serializer = ClientWorkoutDetailSerializer(workout)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Дублирование тренировки"""
        workout = self.get_object()
        new_workout = ClientWorkout.objects.create(
            client=workout.client,
            template=workout.template,
            name=f"{workout.name} (копия)",
            description=workout.description,
            estimated_duration=workout.estimated_duration,
            difficulty=workout.difficulty,
            notes=workout.notes,
            status='draft',
        )
        # Копируем блоки
        for block in workout.blocks.all():
            new_block = WorkoutBlock.objects.create(
                workout=new_workout,
                name=block.name,
                block_type=block.block_type,
                order=block.order,
                rounds=block.rounds,
                rest_between_rounds=block.rest_between_rounds,
            )
            superset_map = {}
            for ex in block.exercises.all():
                new_superset = None
                if ex.superset:
                    if ex.superset.id not in superset_map:
                        superset_map[ex.superset.id] = WorkoutSuperset.objects.create(
                            block=new_block,
                            name=ex.superset.name,
                            order=ex.superset.order,
                            rounds=ex.superset.rounds,
                            rest_after=ex.superset.rest_after,
                        )
                    new_superset = superset_map[ex.superset.id]

                WorkoutExercise.objects.create(
                    block=new_block,
                    exercise=ex.exercise,
                    superset=new_superset,
                    order=ex.order,
                    parameters=ex.parameters,
                    rest_after=ex.rest_after,
                    notes=ex.notes,
                )

        serializer = ClientWorkoutDetailSerializer(new_workout)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def copy_to_client(self, request, pk=None):
        """Копирование тренировки другому клиенту"""
        workout = self.get_object()
        target_client_id = request.data.get('client_id')

        from apps.accounts.models import Client
        try:
            target_client = Client.objects.get(
                id=target_client_id,
                coach=request.user.coach_profile
            )
        except Client.DoesNotExist:
            return Response(
                {'error': 'Клиент не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Создаём копию для другого клиента
        new_workout = ClientWorkout.objects.create(
            client=target_client,
            template=workout.template,
            name=workout.name,
            description=workout.description,
            estimated_duration=workout.estimated_duration,
            difficulty=workout.difficulty,
            notes=workout.notes,
            status='draft',
        )
        # Копируем блоки (аналогично duplicate)
        for block in workout.blocks.all():
            new_block = WorkoutBlock.objects.create(
                workout=new_workout,
                name=block.name,
                block_type=block.block_type,
                order=block.order,
                rounds=block.rounds,
                rest_between_rounds=block.rest_between_rounds,
            )
            superset_map = {}
            for ex in block.exercises.all():
                new_superset = None
                if ex.superset:
                    if ex.superset.id not in superset_map:
                        superset_map[ex.superset.id] = WorkoutSuperset.objects.create(
                            block=new_block,
                            name=ex.superset.name,
                            order=ex.superset.order,
                            rounds=ex.superset.rounds,
                            rest_after=ex.superset.rest_after,
                        )
                    new_superset = superset_map[ex.superset.id]

                WorkoutExercise.objects.create(
                    block=new_block,
                    exercise=ex.exercise,
                    superset=new_superset,
                    order=ex.order,
                    parameters=ex.parameters,
                    rest_after=ex.rest_after,
                    notes=ex.notes,
                )

        serializer = ClientWorkoutDetailSerializer(new_workout)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WorkoutBlockViewSet(viewsets.ModelViewSet):
    """CRUD для блоков тренировки"""
    serializer_class = WorkoutBlockSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WorkoutBlock.objects.filter(
            workout__client__coach=self.request.user.coach_profile
        )

    @action(detail=True, methods=['post'])
    def add_exercise(self, request, pk=None):
        """Добавление упражнения в блок"""
        block = self.get_object()
        serializer = WorkoutExerciseSerializer(data=request.data)
        if serializer.is_valid():
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
    def add_superset(self, request, pk=None):
        """Добавление суперсета в блок"""
        block = self.get_object()
        serializer = WorkoutSupersetSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(block=block)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkoutExerciseViewSet(viewsets.ModelViewSet):
    """CRUD для упражнений в тренировке"""
    serializer_class = WorkoutExerciseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WorkoutExercise.objects.filter(
            block__workout__client__coach=self.request.user.coach_profile
        )
