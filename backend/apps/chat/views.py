from asgiref.sync import async_to_sync

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Client
from apps.bot.telegram_api import send_message
from apps.persona.models import TelegramBot

from .models import ChatMessage, InteractionLog
from .serializers import ChatMessageSerializer, InteractionLogSerializer


class ChatMessageListView(APIView):
    """List chat messages for a client."""

    def get(self, request):
        coach = request.user.coach_profile
        client_id = request.query_params.get('client_id')

        if not client_id:
            return Response({'results': []})

        messages = ChatMessage.objects.filter(
            client_id=client_id,
            client__coach=coach,
            visible_to_user=True,
        ).order_by('created_at')[:100]

        serializer = ChatMessageSerializer(messages, many=True)
        return Response({'results': serializer.data})


class InteractionLogListView(APIView):
    """List interaction logs with filtering and pagination."""

    def get(self, request):
        coach = request.user.coach_profile
        qs = InteractionLog.objects.filter(coach=coach).select_related('client')

        client_id = request.query_params.get('client_id')
        if client_id:
            qs = qs.filter(client_id=client_id)

        interaction_type = request.query_params.get('interaction_type')
        if interaction_type:
            qs = qs.filter(interaction_type=interaction_type)

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        offset = (page - 1) * page_size

        total = qs.count()
        logs = qs[offset:offset + page_size]

        serializer = InteractionLogSerializer(logs, many=True)
        return Response({
            'results': serializer.data,
            'count': total,
            'page': page,
            'page_size': page_size,
        })


class CoachSendMessageView(APIView):
    """Send a message to a client's Telegram on behalf of the coach."""

    def post(self, request):
        coach = request.user.coach_profile
        client_id = request.data.get('client_id')
        text = request.data.get('text', '').strip()

        if not client_id or not text:
            return Response({'error': 'client_id and text are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = Client.objects.get(pk=client_id, coach=coach)
        except Client.DoesNotExist:
            return Response({'error': 'Client not found'}, status=status.HTTP_404_NOT_FOUND)

        bot = TelegramBot.objects.filter(coach=coach, is_active=True).first()
        if not bot:
            return Response({'error': 'No active bot'}, status=status.HTTP_400_BAD_REQUEST)

        # Send via Telegram
        async_to_sync(send_message)(bot.token, client.telegram_user_id, text)

        # Save message
        msg = ChatMessage.objects.create(
            client=client,
            role='assistant',
            message_type='text',
            content=text,
            metadata={'from_coach': True},
        )

        serializer = ChatMessageSerializer(msg)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
