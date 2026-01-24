from rest_framework.response import Response
from rest_framework.views import APIView

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
