import hashlib
import hmac
import json
from urllib.parse import parse_qs, unquote

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.persona.models import BotPersona, TelegramBot

from .models import Client, Coach, User
from .serializers import ClientSerializer, ClientDetailSerializer, CoachSerializer


class TelegramAuthView(APIView):
    """Authenticate Telegram Mini App user via initData."""
    permission_classes = [AllowAny]

    def post(self, request):
        init_data = request.data.get('initData', '')
        if not init_data:
            return Response(
                {'error': 'initData is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Parse initData
        parsed = parse_qs(init_data, keep_blank_values=True)
        received_hash = parsed.get('hash', [''])[0]
        if not received_hash:
            return Response(
                {'error': 'Invalid initData: no hash'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build data_check_string (all params except hash, sorted, \n-joined)
        check_pairs = []
        for key, values in parsed.items():
            if key == 'hash':
                continue
            check_pairs.append(f'{key}={values[0]}')
        check_pairs.sort()
        data_check_string = '\n'.join(check_pairs)

        # Try all active bot tokens for HMAC validation
        bots = TelegramBot.objects.filter(is_active=True)
        validated = False
        for bot in bots:
            secret_key = hmac.new(
                b'WebAppData', bot.token.encode(), hashlib.sha256
            ).digest()
            computed_hash = hmac.new(
                secret_key, data_check_string.encode(), hashlib.sha256
            ).hexdigest()
            if hmac.compare_digest(computed_hash, received_hash):
                validated = True
                break

        if not validated:
            return Response(
                {'error': 'Invalid initData signature'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Extract user info
        user_data_str = parsed.get('user', [''])[0]
        if not user_data_str:
            return Response(
                {'error': 'No user data in initData'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            tg_user = json.loads(unquote(user_data_str))
        except (json.JSONDecodeError, TypeError):
            return Response(
                {'error': 'Invalid user data'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        telegram_user_id = tg_user.get('id')
        if not telegram_user_id:
            return Response(
                {'error': 'No user id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find client
        try:
            client = Client.objects.select_related('coach').get(
                telegram_user_id=telegram_user_id
            )
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get or create User for JWT
        user, created = User.objects.get_or_create(
            username=f'tg_{telegram_user_id}',
            defaults={
                'role': 'client',
                'first_name': tg_user.get('first_name', ''),
                'last_name': tg_user.get('last_name', ''),
            },
        )
        if not created:
            # Update name if changed
            changed = False
            if tg_user.get('first_name') and user.first_name != tg_user['first_name']:
                user.first_name = tg_user['first_name']
                changed = True
            if tg_user.get('last_name', '') != user.last_name:
                user.last_name = tg_user.get('last_name', '')
                changed = True
            if changed:
                user.save(update_fields=['first_name', 'last_name'])

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        # Add client_id to token claims
        refresh['client_id'] = client.pk
        refresh['coach_id'] = client.coach_id

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'client': {
                'id': client.pk,
                'first_name': client.first_name,
                'last_name': client.last_name,
                'daily_calories': client.daily_calories,
                'daily_proteins': client.daily_proteins,
                'daily_fats': client.daily_fats,
                'daily_carbs': client.daily_carbs,
                'daily_water': client.daily_water,
                'onboarding_completed': client.onboarding_completed,
            },
        })


class CoachProfileView(viewsets.GenericViewSet):
    serializer_class = CoachSerializer

    def get_object(self):
        return self.request.user.coach_profile

    def list(self, request):
        coach = self.get_object()
        serializer = self.get_serializer(coach)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        coach = self.get_object()
        serializer = self.get_serializer(coach, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['first_name', 'last_name', 'telegram_username']
    ordering_fields = ['created_at', 'first_name', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        return Client.objects.filter(coach=self.request.user.coach_profile)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ClientDetailSerializer
        return ClientSerializer

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        client = self.get_object()
        client.status = 'paused'
        client.save(update_fields=['status'])
        return Response({'status': 'paused'})

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        client = self.get_object()
        client.status = 'active'
        client.save(update_fields=['status'])
        return Response({'status': 'active'})

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        client = self.get_object()
        client.status = 'archived'
        client.save(update_fields=['status'])
        return Response({'status': 'archived'})

    @action(detail=True, methods=['post'], url_path='set_persona')
    def set_persona(self, request, pk=None):
        client = self.get_object()
        persona_id = request.data.get('persona_id')
        if persona_id is None:
            # Unbind persona
            client.persona = None
            client.save(update_fields=['persona'])
            return Response(ClientSerializer(client).data)
        try:
            persona = BotPersona.objects.get(pk=persona_id, coach=request.user.coach_profile)
        except BotPersona.DoesNotExist:
            return Response({'error': 'Персона не найдена'}, status=status.HTTP_404_NOT_FOUND)
        client.persona = persona
        client.save(update_fields=['persona'])
        return Response(ClientSerializer(client).data)
