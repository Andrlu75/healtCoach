import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client

from .models import CONTEXT_BLOCKS, Reminder
from .serializers import ReminderCreateSerializer, ReminderSerializer
from .services import compute_next_fire, generate_ai_text

logger = logging.getLogger(__name__)


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

        reminder_type = serializer.validated_data.get('reminder_type', 'custom')

        # Авто-настройки по типу
        if reminder_type == 'morning':
            serializer.validated_data['frequency'] = 'daily'
            serializer.validated_data['is_smart'] = True
        elif reminder_type == 'meal_program':
            serializer.validated_data['frequency'] = 'daily'
        elif reminder_type == 'event':
            serializer.validated_data['frequency'] = 'custom'

        reminder = Reminder.objects.create(
            coach=coach,
            client=client,
            **serializer.validated_data,
        )

        # Calculate initial next_fire_at (не для event — у них динамическое)
        if reminder_type != 'event':
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


class ContextBlocksView(APIView):
    """GET: список доступных контекстных блоков для утреннего приветствия."""

    def get(self, request):
        return Response(CONTEXT_BLOCKS)


class ReminderGenerateTextView(APIView):
    """POST: генерация текста уведомления через AI."""

    def post(self, request):
        coach = request.user.coach_profile
        client_id = request.data.get('client_id')
        reminder_type = request.data.get('reminder_type', 'custom')
        context_blocks = request.data.get('context_blocks', [])
        base_text = request.data.get('base_text', '')
        generation_prompt = request.data.get('generation_prompt', '')

        if not client_id:
            return Response({'error': 'client_id обязателен'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            text = generate_ai_text(
                coach=coach,
                client=client,
                reminder_type=reminder_type,
                context_blocks=context_blocks,
                base_text=base_text,
                generation_prompt=generation_prompt,
            )
            return Response({'text': text})
        except Exception as e:
            logger.exception('Error generating reminder text: %s', e)
            return Response(
                {'error': 'Не удалось сгенерировать текст'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
