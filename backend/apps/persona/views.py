from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import BotPersona
from .serializers import BotPersonaSerializer, AISettingsSerializer, TelegramSettingsSerializer


class BotPersonaView(APIView):

    def get(self, request):
        persona, _ = BotPersona.objects.get_or_create(
            coach=request.user.coach_profile,
            defaults={'system_prompt': self._default_system_prompt()}
        )
        serializer = BotPersonaSerializer(persona)
        return Response(serializer.data)

    def put(self, request):
        persona, _ = BotPersona.objects.get_or_create(
            coach=request.user.coach_profile,
            defaults={'system_prompt': self._default_system_prompt()}
        )
        serializer = BotPersonaSerializer(persona, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def _default_system_prompt(self):
        return (
            'Ты — дружелюбный помощник health-коуча. '
            'Общайся легко и непринуждённо, как со старым другом. '
            'Не давай медицинских рекомендаций. '
            'Твоя роль — дружеская поддержка и лёгкая мотивация.'
        )


class AISettingsView(APIView):

    def get(self, request):
        persona, _ = BotPersona.objects.get_or_create(
            coach=request.user.coach_profile
        )
        data = {
            'ai_provider': persona.ai_provider,
            'ai_model_chat': persona.ai_model_chat,
            'ai_model_vision': persona.ai_model_vision,
            'temperature': persona.temperature,
            'max_tokens': persona.max_tokens,
            'openai_api_key': '',
            'anthropic_api_key': '',
        }
        return Response(data)

    def put(self, request):
        serializer = AISettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        persona, _ = BotPersona.objects.get_or_create(
            coach=request.user.coach_profile
        )
        persona.ai_provider = serializer.validated_data['ai_provider']
        persona.ai_model_chat = serializer.validated_data['ai_model_chat']
        persona.ai_model_vision = serializer.validated_data['ai_model_vision']
        persona.temperature = serializer.validated_data['temperature']
        persona.max_tokens = serializer.validated_data['max_tokens']
        persona.save()

        # TODO: Save API keys securely (encrypted in DB or env)

        return Response({'status': 'updated'})


class TelegramSettingsView(APIView):

    def get(self, request):
        # TODO: Load from CoachSettings model
        data = {
            'bot_token': '',
            'webhook_url': '',
            'notification_chat_id': '',
        }
        return Response(data)

    def put(self, request):
        serializer = TelegramSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # TODO: Save settings and reconfigure webhook
        return Response({'status': 'updated'})


class DashboardStatsView(APIView):

    def get(self, request):
        coach = request.user.coach_profile
        clients = coach.clients.all()

        stats = {
            'total_clients': clients.count(),
            'active_clients': clients.filter(status='active').count(),
            'pending_clients': clients.filter(status='pending').count(),
            'paused_clients': clients.filter(status='paused').count(),
        }
        return Response(stats)
