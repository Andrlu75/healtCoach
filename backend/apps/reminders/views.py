from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client

from .models import Reminder
from .serializers import ReminderCreateSerializer, ReminderSerializer
from .services import compute_next_fire


class ReminderListView(APIView):
    """List and create reminders."""

    def get(self, request):
        coach = request.user.coach_profile
        client_id = request.query_params.get('client_id')

        queryset = Reminder.objects.filter(coach=coach).select_related('client')
        if client_id:
            queryset = queryset.filter(client_id=client_id)

        serializer = ReminderSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        coach = request.user.coach_profile
        serializer = ReminderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        client_id = serializer.validated_data.pop('client_id')
        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        reminder = Reminder.objects.create(
            coach=coach,
            client=client,
            **serializer.validated_data,
        )

        # Calculate initial next_fire_at
        reminder.next_fire_at = compute_next_fire(reminder)
        reminder.save(update_fields=['next_fire_at'])

        return Response(
            ReminderSerializer(reminder).data,
            status=status.HTTP_201_CREATED,
        )


class ReminderDetailView(APIView):
    """Update and delete reminders."""

    def put(self, request, pk):
        coach = request.user.coach_profile
        try:
            reminder = Reminder.objects.get(pk=pk, coach=coach)
        except Reminder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = ReminderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Validate client
        client_id = serializer.validated_data.pop('client_id')
        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        reminder.client = client
        for field, value in serializer.validated_data.items():
            setattr(reminder, field, value)
        reminder.next_fire_at = compute_next_fire(reminder)
        reminder.save()

        return Response(ReminderSerializer(reminder).data)

    def delete(self, request, pk):
        coach = request.user.coach_profile
        try:
            reminder = Reminder.objects.get(pk=pk, coach=coach)
        except Reminder.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        reminder.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
