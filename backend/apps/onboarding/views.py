from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.persona.models import TelegramBot

from .models import InviteLink, OnboardingQuestion
from .serializers import (
    InviteLinkCreateSerializer,
    InviteLinkSerializer,
    OnboardingQuestionCreateSerializer,
    OnboardingQuestionSerializer,
    OnboardingQuestionUpdateSerializer,
)


class InviteLinkListView(APIView):
    """List and create invite links."""

    def get(self, request):
        coach = request.user.coach_profile
        invites = InviteLink.objects.filter(coach=coach).order_by('-created_at')

        # Get active bot for deep link
        bot = TelegramBot.objects.filter(coach=coach, is_active=True).first()
        bot_username = bot.username if bot else ''
        miniapp_short_name = bot.miniapp_short_name if bot else ''

        serializer = InviteLinkSerializer(
            invites, many=True,
            context={
                'request': request,
                'bot_username': bot_username,
                'miniapp_short_name': miniapp_short_name,
            },
        )
        return Response(serializer.data)

    def post(self, request):
        coach = request.user.coach_profile
        serializer = InviteLinkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invite = InviteLink.objects.create(
            coach=coach,
            max_uses=serializer.validated_data['max_uses'],
            expires_at=serializer.validated_data.get('expires_at'),
        )

        bot = TelegramBot.objects.filter(coach=coach, is_active=True).first()
        bot_username = bot.username if bot else ''
        miniapp_short_name = bot.miniapp_short_name if bot else ''

        return Response(
            InviteLinkSerializer(
                invite,
                context={
                    'request': request,
                    'bot_username': bot_username,
                    'miniapp_short_name': miniapp_short_name,
                },
            ).data,
            status=status.HTTP_201_CREATED,
        )


class InviteLinkDeleteView(APIView):
    """Delete an invite link."""

    def delete(self, request, pk):
        coach = request.user.coach_profile
        try:
            invite = InviteLink.objects.get(pk=pk, coach=coach)
        except InviteLink.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        invite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OnboardingQuestionListView(APIView):
    """List and create onboarding questions."""

    def get(self, request):
        coach = request.user.coach_profile
        questions = OnboardingQuestion.objects.filter(coach=coach)
        serializer = OnboardingQuestionSerializer(questions, many=True)
        return Response(serializer.data)

    def post(self, request):
        coach = request.user.coach_profile
        serializer = OnboardingQuestionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = OnboardingQuestion.objects.create(
            coach=coach,
            **serializer.validated_data,
        )
        return Response(
            OnboardingQuestionSerializer(question).data,
            status=status.HTTP_201_CREATED,
        )


class OnboardingQuestionDetailView(APIView):
    """Update and delete onboarding questions."""

    def put(self, request, pk):
        coach = request.user.coach_profile
        try:
            question = OnboardingQuestion.objects.get(pk=pk, coach=coach)
        except OnboardingQuestion.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = OnboardingQuestionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(question, field, value)
        question.save()

        return Response(OnboardingQuestionSerializer(question).data)

    def delete(self, request, pk):
        coach = request.user.coach_profile
        try:
            question = OnboardingQuestion.objects.get(pk=pk, coach=coach)
        except OnboardingQuestion.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        question.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
