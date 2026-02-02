"""
Client-facing views for workouts - for miniapp
"""
import zoneinfo
from datetime import date

from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client
from apps.workouts.models import (
    FitDBWorkoutAssignment,
    FitDBWorkoutSession,
    WorkoutTemplateExercise,
)


def get_client_timezone(client):
    """Get timezone object for client."""
    try:
        return zoneinfo.ZoneInfo(client.timezone or 'Europe/Moscow')
    except Exception:
        return zoneinfo.ZoneInfo('Europe/Moscow')


def get_client_from_request(request):
    """Extract client from JWT token claims."""
    if not request.auth:
        return None

    try:
        payload = getattr(request.auth, 'payload', None)
        if payload:
            client_id = payload.get('client_id')
        else:
            client_id = request.auth['client_id']
    except (AttributeError, KeyError, TypeError):
        client_id = None

    if not client_id:
        return None
    try:
        return Client.objects.get(pk=client_id)
    except Client.DoesNotExist:
        return None


class ClientTodayWorkoutsView(APIView):
    """
    GET /api/miniapp/workouts/today/
    Returns today's workout assignments for the authenticated client.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        client = get_client_from_request(request)
        if not client:
            return Response(
                {'error': 'Client not found'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Get today's date in client's timezone
        client_tz = get_client_timezone(client)
        client_now = timezone.now().astimezone(client_tz)
        client_today = client_now.date()

        # Get today's assignments OR pending ones
        assignments = FitDBWorkoutAssignment.objects.filter(
            client=client,
        ).filter(
            # Show: today's assignments OR pending ones (not yet completed)
            due_date=client_today
        ).exclude(
            status='completed'
        ).select_related('workout').annotate(
            exercise_count=Count('workout__blocks__exercises')
        ).order_by('due_date', '-assigned_at')

        workouts = []
        for assignment in assignments:
            # Get latest session for this workout
            latest_session = FitDBWorkoutSession.objects.filter(
                workout=assignment.workout,
                client=client,
            ).order_by('-started_at').first()

            # Determine workout status
            workout_status = assignment.status
            session_data = None
            if latest_session:
                if latest_session.completed_at:
                    workout_status = 'completed'
                else:
                    workout_status = 'in_progress'
                session_data = {
                    'id': latest_session.id,
                    'status': 'completed' if latest_session.completed_at else 'in_progress',
                    'duration_seconds': latest_session.duration_seconds,
                }

            workouts.append({
                'id': assignment.id,
                'workout_id': assignment.workout.id,
                'name': assignment.workout.name,
                'description': assignment.workout.description or '',
                'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
                'status': workout_status,
                'exercise_count': assignment.exercise_count or 0,
                'session': session_data,
            })

        return Response({
            'date': client_today.isoformat(),
            'has_workouts': len(workouts) > 0,
            'workouts': workouts,
        })
