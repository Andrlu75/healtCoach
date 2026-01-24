from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatMessage
from .serializers import ChatMessageSerializer


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
