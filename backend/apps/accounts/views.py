import hashlib
import hmac
import json
import logging
import time
from urllib.parse import parse_qs, unquote

from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.onboarding.models import InviteLink
from apps.persona.models import BotPersona, TelegramBot

from .models import Client, Coach, User
from .serializers import ClientSerializer, ClientDetailSerializer, CoachSerializer, FitDBClientSerializer

logger = logging.getLogger(__name__)


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
        bots = list(TelegramBot.objects.filter(is_active=True))
        validated = False
        validated_bot = None
        for bot in bots:
            secret_key = hmac.new(
                b'WebAppData', bot.token.encode(), hashlib.sha256
            ).digest()
            computed_hash = hmac.new(
                secret_key, data_check_string.encode(), hashlib.sha256
            ).hexdigest()
            if hmac.compare_digest(computed_hash, received_hash):
                validated = True
                validated_bot = bot
                break

        if not validated:
            return Response(
                {'error': 'Invalid initData signature'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Validate auth_date freshness (prevent replay attacks)
        auth_date_str = parsed.get('auth_date', [''])[0]
        if auth_date_str:
            try:
                auth_date = int(auth_date_str)
                # Allow tokens up to 24 hours old (configurable)
                max_age = getattr(settings, 'TELEGRAM_AUTH_MAX_AGE', 86400)
                if time.time() - auth_date > max_age:
                    logger.warning('Expired initData: auth_date=%s, age=%ds', auth_date, time.time() - auth_date)
                    return Response(
                        {'error': 'Auth data expired'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            except (ValueError, TypeError):
                pass  # Invalid auth_date format, continue anyway

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

        # Extract start_param (invite code) if present
        start_param = parsed.get('start_param', [''])[0]

        # Find client
        client = Client.objects.select_related('coach').filter(
            telegram_user_id=telegram_user_id
        ).first()

        if not client:
            # New user - check for invite code
            if not start_param:
                return Response({
                    'status': 'need_invite',
                    'message': 'Для регистрации необходима ссылка от коуча',
                })

            # Validate invite code
            invite = self._validate_invite(start_param)
            if not invite:
                return Response({
                    'status': 'invalid_invite',
                    'message': 'Ссылка недействительна или истекла',
                })

            # Create new client
            client = Client.objects.create(
                coach=invite.coach,
                telegram_user_id=telegram_user_id,
                telegram_username=tg_user.get('username', ''),
                first_name=tg_user.get('first_name', ''),
                last_name=tg_user.get('last_name', ''),
                status='pending',
                onboarding_completed=False,
                onboarding_data={
                    'started': True,
                    'current_question_index': 0,
                    'answers': {},
                },
            )

            # Use invite (increment counter)
            invite.uses_count += 1
            invite.save(update_fields=['uses_count'])

            logger.info(
                'New client registered via miniapp: client=%s, invite=%s',
                client.pk, invite.code[:8]
            )

        elif not client.coach_id:
            # Client exists but has no coach - need invite
            if not start_param:
                return Response({
                    'status': 'need_invite',
                    'message': 'Для регистрации необходима ссылка от коуча',
                })

            invite = self._validate_invite(start_param)
            if not invite:
                return Response({
                    'status': 'invalid_invite',
                    'message': 'Ссылка недействительна или истекла',
                })

            # Link client to coach
            client.coach = invite.coach
            client.onboarding_completed = False
            client.onboarding_data = {
                'started': True,
                'current_question_index': 0,
                'answers': {},
            }
            client.save(update_fields=['coach', 'onboarding_completed', 'onboarding_data'])

            invite.uses_count += 1
            invite.save(update_fields=['uses_count'])

            logger.info(
                'Existing client linked to coach via miniapp: client=%s, coach=%s',
                client.pk, invite.coach_id
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

    def _validate_invite(self, code: str) -> InviteLink | None:
        """Validate invite code. Returns InviteLink if valid, None otherwise."""
        invite = InviteLink.objects.select_related('coach').filter(
            code=code, is_active=True
        ).first()

        if not invite:
            return None

        # Check expiration
        if invite.expires_at and invite.expires_at < timezone.now():
            return None

        # Check usage limit
        if invite.uses_count >= invite.max_uses:
            return None

        return invite


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
        qs = Client.objects.filter(coach=self.request.user.coach_profile)
        # Для списка - prefetch persona для избежания N+1
        if self.action == 'list':
            qs = qs.select_related('persona')
        # Для детального просмотра - prefetch meals и messages для счётчиков
        elif self.action == 'retrieve':
            from django.db.models import Count, Max
            qs = qs.select_related('persona').annotate(
                _meals_count=Count('meals'),
                _last_activity=Max('messages__created_at')
            )
        return qs

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


class FitDBClientViewSet(viewsets.ReadOnlyModelViewSet):
    """FitDB API for clients - requires authentication, shows only coach's clients"""
    serializer_class = FitDBClientSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['first_name', 'last_name', 'telegram_username']
    ordering_fields = ['created_at', 'first_name']
    ordering = ['first_name']

    def get_queryset(self):
        # Показываем только клиентов текущего коуча
        return Client.objects.filter(
            coach=self.request.user.coach_profile
        ).exclude(status='archived')


class ChangePasswordView(APIView):
    """Change password for authenticated user."""

    def post(self, request):
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')

        if not current_password or not new_password:
            return Response(
                {'error': 'Необходимо указать текущий и новый пароли'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        if not user.check_password(current_password):
            return Response(
                {'error': 'Неверный текущий пароль'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 6:
            return Response(
                {'error': 'Новый пароль должен содержать минимум 6 символов'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=['password'])

        return Response({'status': 'ok', 'message': 'Пароль успешно изменён'})
