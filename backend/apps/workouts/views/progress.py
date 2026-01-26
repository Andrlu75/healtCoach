from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from apps.workouts.models import WorkoutSession, ExerciseLog, ClientWorkout, WorkoutExercise
from apps.workouts.serializers import (
    WorkoutSessionSerializer,
    WorkoutSessionDetailSerializer,
    ExerciseLogSerializer,
    StartSessionSerializer,
    LogSetSerializer,
)


class WorkoutSessionViewSet(viewsets.ModelViewSet):
    """CRUD для сессий тренировок"""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Для коуча - все сессии его клиентов
        return WorkoutSession.objects.filter(
            workout__client__coach=self.request.user.coach_profile
        ).select_related('workout__client')

    def get_serializer_class(self):
        if self.action in ['retrieve', 'current']:
            return WorkoutSessionDetailSerializer
        return WorkoutSessionSerializer

    @action(detail=False, methods=['post'])
    def start(self, request):
        """Начало сессии тренировки (вызывается из miniapp)"""
        serializer = StartSessionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        workout = serializer.workout

        # Подсчитываем количество упражнений и подходов
        exercises = WorkoutExercise.objects.filter(block__workout=workout)
        total_exercises = exercises.count()
        total_sets = sum(
            ex.parameters.get('sets', 1) for ex in exercises
        )

        session = WorkoutSession.objects.create(
            workout=workout,
            total_exercises=total_exercises,
            total_sets=total_sets,
        )

        # Обновляем статус тренировки
        workout.status = 'in_progress'
        workout.save()

        # Создаём пустые логи для всех подходов
        for ex in exercises:
            sets = ex.parameters.get('sets', 1)
            for set_num in range(1, sets + 1):
                ExerciseLog.objects.create(
                    session=session,
                    workout_exercise=ex,
                    set_number=set_num,
                    planned_parameters=ex.parameters,
                )

        return Response(
            WorkoutSessionDetailSerializer(session).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def log_set(self, request, pk=None):
        """Логирование выполненного подхода"""
        session = self.get_object()
        if session.status != 'in_progress':
            return Response(
                {'error': 'Сессия не активна'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = LogSetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            log = ExerciseLog.objects.get(
                session=session,
                workout_exercise_id=data['workout_exercise_id'],
                set_number=data['set_number']
            )
        except ExerciseLog.DoesNotExist:
            return Response(
                {'error': 'Подход не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

        log.actual_parameters = data['actual_parameters']
        log.is_completed = data['is_completed']
        log.notes = data.get('notes', '')
        log.finished_at = timezone.now()
        log.save()

        # Обновляем статистику сессии
        completed_sets = session.exercise_logs.filter(is_completed=True).count()
        session.completed_sets = completed_sets

        # Считаем завершённые упражнения
        completed_exercises = 0
        exercises = WorkoutExercise.objects.filter(block__workout=session.workout)
        for ex in exercises:
            sets = ex.parameters.get('sets', 1)
            completed = session.exercise_logs.filter(
                workout_exercise=ex,
                is_completed=True
            ).count()
            if completed >= sets:
                completed_exercises += 1
        session.completed_exercises = completed_exercises
        session.save()

        return Response(ExerciseLogSerializer(log).data)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """Приостановка сессии"""
        session = self.get_object()
        if session.status != 'in_progress':
            return Response(
                {'error': 'Сессия не активна'},
                status=status.HTTP_400_BAD_REQUEST
            )
        session.status = 'paused'
        session.save()
        return Response({'status': 'paused'})

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        """Возобновление сессии"""
        session = self.get_object()
        if session.status != 'paused':
            return Response(
                {'error': 'Сессия не приостановлена'},
                status=status.HTTP_400_BAD_REQUEST
            )
        session.status = 'in_progress'
        session.save()
        return Response({'status': 'in_progress'})

    @action(detail=True, methods=['post'])
    def finish(self, request, pk=None):
        """Завершение сессии"""
        session = self.get_object()
        if session.status not in ['in_progress', 'paused']:
            return Response(
                {'error': 'Сессия уже завершена'},
                status=status.HTTP_400_BAD_REQUEST
            )

        session.status = 'completed'
        session.finished_at = timezone.now()
        session.duration_seconds = int(
            (session.finished_at - session.started_at).total_seconds()
        )
        session.client_notes = request.data.get('client_notes', '')
        session.client_rating = request.data.get('client_rating')
        session.fatigue_level = request.data.get('fatigue_level')
        session.save()

        # Обновляем статус тренировки
        session.workout.status = 'completed'
        session.workout.save()

        return Response(WorkoutSessionDetailSerializer(session).data)

    @action(detail=True, methods=['post'])
    def abandon(self, request, pk=None):
        """Прерывание сессии"""
        session = self.get_object()
        session.status = 'abandoned'
        session.finished_at = timezone.now()
        session.duration_seconds = int(
            (session.finished_at - session.started_at).total_seconds()
        )
        session.save()

        # Возвращаем статус тренировки
        session.workout.status = 'scheduled'
        session.workout.save()

        return Response({'status': 'abandoned'})
