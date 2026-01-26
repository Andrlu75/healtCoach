from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.workouts.models import TrainingSchedule, TrainingProgram, ProgramWorkout
from apps.workouts.serializers import (
    TrainingScheduleSerializer,
    TrainingProgramListSerializer,
    TrainingProgramDetailSerializer,
    ProgramWorkoutSerializer,
)


class TrainingScheduleViewSet(viewsets.ModelViewSet):
    """CRUD для расписаний тренировок"""
    serializer_class = TrainingScheduleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['client', 'is_active']

    def get_queryset(self):
        return TrainingSchedule.objects.filter(
            client__coach=self.request.user.coach_profile
        ).select_related('client', 'template')


class TrainingProgramViewSet(viewsets.ModelViewSet):
    """CRUD для программ тренировок"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['client', 'status']

    def get_queryset(self):
        return TrainingProgram.objects.filter(
            client__coach=self.request.user.coach_profile
        ).select_related('client').prefetch_related('program_workouts__workout')

    def get_serializer_class(self):
        if self.action == 'list':
            return TrainingProgramListSerializer
        return TrainingProgramDetailSerializer

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Запуск программы"""
        program = self.get_object()
        if program.status != 'draft':
            return Response(
                {'error': 'Программа уже запущена'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils import timezone
        program.status = 'active'
        program.start_date = request.data.get('start_date', timezone.now().date())
        program.current_week = 1
        program.save()

        serializer = TrainingProgramDetailSerializer(program)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """Приостановка программы"""
        program = self.get_object()
        if program.status != 'active':
            return Response(
                {'error': 'Программа не активна'},
                status=status.HTTP_400_BAD_REQUEST
            )
        program.status = 'paused'
        program.save()
        return Response({'status': 'paused'})

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        """Возобновление программы"""
        program = self.get_object()
        if program.status != 'paused':
            return Response(
                {'error': 'Программа не приостановлена'},
                status=status.HTTP_400_BAD_REQUEST
            )
        program.status = 'active'
        program.save()
        return Response({'status': 'active'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Завершение программы"""
        program = self.get_object()
        program.status = 'completed'
        program.save()
        return Response({'status': 'completed'})

    @action(detail=True, methods=['post'])
    def add_workout(self, request, pk=None):
        """Добавление тренировки в программу"""
        program = self.get_object()
        serializer = ProgramWorkoutSerializer(data=request.data)
        if serializer.is_valid():
            # Проверяем, что тренировка принадлежит тому же клиенту
            workout = serializer.validated_data['workout']
            if workout.client != program.client:
                return Response(
                    {'error': 'Тренировка не принадлежит клиенту программы'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            serializer.save(program=program)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def advance_week(self, request, pk=None):
        """Переход к следующей неделе"""
        program = self.get_object()
        if program.current_week >= program.duration_weeks:
            return Response(
                {'error': 'Это последняя неделя программы'},
                status=status.HTTP_400_BAD_REQUEST
            )
        program.current_week += 1
        program.save()
        return Response({'current_week': program.current_week})
